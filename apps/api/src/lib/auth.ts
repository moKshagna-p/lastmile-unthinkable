import { SignJWT, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { env } from "../env";
import type { Role } from "@lastmile/shared";

const secret = new TextEncoder().encode(env.jwtSecret);
export const AUTH_COOKIE = "lm_token";

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.id || !payload.role) return null;
    return { id: payload.id as string, role: payload.role as Role, name: payload.name as string, email: payload.email as string };
  } catch {
    return null;
  }
}

function extractToken(c: Context): string | undefined {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return getCookie(c, AUTH_COOKIE);
}

/** Resolves the current user (if any) onto the context. */
export async function attachUser(c: Context, next: Next) {
  const token = extractToken(c);
  if (token) c.set("user", await verifyToken(token));
  await next();
}

export function currentUser(c: Context): AuthUser | null {
  return c.get("user") ?? null;
}

/** Requires a signed-in user; optionally restricted to specific roles. */
export function requireAuth(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = currentUser(c);
    if (!user) return c.json({ error: "Authentication required" }, 401);
    if (roles.length > 0 && !roles.includes(user.role)) {
      return c.json({ error: `Forbidden — requires role: ${roles.join(" or ")}` }, 403);
    }
    await next();
  };
}

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
