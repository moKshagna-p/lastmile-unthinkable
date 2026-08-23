import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Context, Next } from "hono";
import { db } from "../db";
import { accounts, sessions, users, verifications } from "../db/schema";
import { env } from "../env";
import type { Role } from "@lastmile/shared";

/**
 * Better Auth — owns identity, credentials (scrypt in `account`) and cookie
 * sessions (`session` table). Mounted at /auth/* in src/index.ts.
 *
 * Domain fields on the user row:
 *  • phone  — collected at sign-up (required)
 *  • role   — CUSTOMER | AGENT | ADMIN; `input: false` so clients can never
 *             self-assign it. AGENT/ADMIN are granted server-side only
 *             (see routes/admin.ts agent creation).
 */
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  trustedOrigins: [env.webUrl, "http://localhost:3000", "http://localhost:3001"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
    /**
     * Cache the session inside the signed session cookie for 5 minutes:
     * getSession() (run by attachUser on every request) stops hitting
     * Postgres for user + session rows while the cookie is fresh.
     * Trade-off: role/status changes take up to 5 min to propagate — fine
     * for this app; sign-out still clears immediately server-side.
     */
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: true, input: true },
      role: { type: "string", required: false, input: false, defaultValue: "CUSTOMER" },
    },
  },
});

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

/** Resolves the Better Auth session onto the Hono context (once per request). */
export async function attachUser(c: Context, next: Next) {
  // No session cookie at all → no session to resolve. Skip the DB entirely
  // for public/cold requests instead of paying a guaranteed-miss lookup.
  const cookie = c.req.header("cookie") ?? "";
  if (!cookie.includes("session_token")) return next();
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user) c.set("user", session.user);
  } catch {
    // No/invalid session — request proceeds unauthenticated.
  }
  await next();
}

export function currentUser(c: Context): AuthUser | null {
  const u = c.get("user") as
    | { id: string; role: Role; name: string; email: string }
    | undefined;
  return u ? { id: u.id, role: u.role, name: u.name, email: u.email } : null;
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
