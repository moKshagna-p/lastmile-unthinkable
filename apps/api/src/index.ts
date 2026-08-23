import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "bun";
import { env } from "./env";
import { freePort } from "./scripts/free-port";
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

// Bind to the configured port. Before binding, free any stale listener from a
// previous session — this covers EVERY launch path (bun run dev, the raw
// `bun --hot src/index.ts`, anything). Production skips cleanup; there, an
// EADDRINUSE fail-fast remains as the guard: the web app targets this exact
// URL, so silently hopping ports would leave the frontend calling a dead
// endpoint.
const port = env.port;
if (process.env.NODE_ENV !== "production") await freePort(port);
const server = (() => {
  try {
    return serve({ port, fetch: app.fetch });
  } catch (err) {
    const e = err as { code?: string };
    if (e?.code === "EADDRINUSE") {
      console.error(`\n✗ Port ${port} still busy after cleanup — inspect: lsof -nP -iTCP:${port} -sTCP:LISTEN\n`);
      process.exit(1);
    }
    throw err;
  }
})();

// Graceful shutdown — release the socket cleanly on Ctrl+C / kill so the next
// boot never has to fight a zombie listener in the first place.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} — shutting down…`);
    server.stop(true);
    process.exit(0);
  });
}
console.log(`🚚 LastMile API listening on http://localhost:${port}`);