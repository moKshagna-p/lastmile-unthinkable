import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "bun";
import { env } from "./env";
import { attachUser, auth } from "./lib/auth";
import { orderRoutes, ValidationError } from "./routes/orders";
import { adminRoutes } from "./routes/admin";
import { agentRoutes } from "./routes/agent";
import { PricingError } from "./lib/pricing";

const app = new Hono();

app.use(logger());
app.use(
  cors({
    origin: [env.webUrl, "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use("*", attachUser);

app.get("/", (c) => c.json({ name: "LastMile API", status: "ok", time: new Date().toISOString() }));
app.get("/health", (c) => c.json({ ok: true }));

// Better Auth owns everything under /api/auth/* — sign-up/sign-in/sign-out,
// session introspection (its default basePath). Cookies are httpOnly; CORS
// credentials stay on.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/orders", orderRoutes);
app.route("/admin", adminRoutes);
app.route("/agent", agentRoutes);

// Uniform error mapping
app.onError((err, c) => {
  if (err instanceof PricingError) return c.json({ error: err.message }, err.status as 422);
  if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
  if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
  const anyErr = err as { status?: number; message?: string };
  if (anyErr.status && anyErr.message) return c.json({ error: anyErr.message }, anyErr.status as 500);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// Bind to the configured port. Fail fast if it's taken: the web app targets
// this exact URL (localhost:4000), so silently hopping ports would leave the
// frontend calling a dead endpoint. Kill the stale process instead.
const port = env.port;
try {
  serve({ port, fetch: app.fetch });
} catch (err) {
  const e = err as { code?: string };
  if (e?.code === "EADDRINUSE") {
    console.error(
      `\n✗ Port ${port} is already in use — a previous dev server is still running.\n` +
        `  Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
        `  Kill it:  kill <PID>   (use kill -9 <PID> if it ignores SIGTERM)\n`,
    );
    process.exit(1);
  }
  throw err;
}
console.log(`🚚 LastMile API listening on http://localhost:${port}`);
