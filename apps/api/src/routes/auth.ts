import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { agents, users } from "../db/schema";
import {
  AUTH_COOKIE,
  currentUser,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from "../lib/auth";
import { loginSchema, registerSchema } from "@lastmile/shared";

export const authRoutes = new Hono();

function setAuthCookie(c: any, token: string) {
  c.header(
    "Set-Cookie",
    `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
  );
}

authRoutes.post("/register", async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const [existing] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
  if (existing) return c.json({ error: "An account with this email already exists" }, 409);

  const [user] = await db
    .insert(users)
    .values({
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone,
      passwordHash: await hashPassword(body.password),
      role: "CUSTOMER",
    })
    .returning();

  const token = await signToken({ id: user.id, role: user.role, name: user.name, email: user.email });
  setAuthCookie(c, token);
  return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  const token = await signToken({ id: user.id, role: user.role, name: user.name, email: user.email });
  setAuthCookie(c, token);
  return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRoutes.post("/logout", (c) => {
  c.header("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth(), (c) => {
  return c.json({ user: currentUser(c) });
});
