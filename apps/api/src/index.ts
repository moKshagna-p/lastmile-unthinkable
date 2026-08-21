import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "bun";
import { env } from "./env";
import { attachUser } from "./lib/auth";
import { authRoutes } from "./routes/auth";
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

app.route("/auth", authRoutes);
app.route("/orders", orderRoutes);
app.route("/admin", adminRoutes);
app.route("/agent", agentRoutes);

// Uniform error mapping
app.onError((err, c) => {
  if (err instanceof PricingError) return c.json({ error: err.message }, err.status as 422);
  if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
  const anyErr = err as { status?: number; message?: string };
  if (anyErr.status && anyErr.message) return c.json({ error: anyErr.message }, anyErr.status as 500);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// Bind to the configured port; if it's taken (EADDRINUSE), hop upward until a
// free one is found so a stray dev server never blocks development.
const BASE_PORT = env.port;
const MAX_PORT_HOPS = 10;

let boundPort = BASE_PORT;
for (let attempt = 0; ; attempt++) {
  try {
    serve({ port: boundPort, fetch: app.fetch });
    break;
  } catch (err) {
    const e = err as { code?: string };
    if (e?.code === "EADDRINUSE" && attempt < MAX_PORT_HOPS) {
      console.warn(`⚠ Port ${boundPort} is in use — trying ${boundPort + 1}`);
      boundPort += 1;
      continue;
    }
    throw err;
  }
}
console.log(`🚚 LastMile API listening on http://localhost:${boundPort}`);
