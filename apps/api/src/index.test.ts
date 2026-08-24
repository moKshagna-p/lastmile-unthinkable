import { expect, test } from "bun:test";

test("exports the Hono app without starting a listener on Vercel", async () => {
  const previous = {
    VERCEL: process.env.VERCEL,
    API_PORT: process.env.API_PORT,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  };

  process.env.VERCEL = "1";
  process.env.API_PORT = "0";
  process.env.NODE_ENV = "production";
  process.env.BETTER_AUTH_SECRET = "test-only-secret-with-at-least-32-characters";

  try {
    const { default: app } = await import("./index");
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
