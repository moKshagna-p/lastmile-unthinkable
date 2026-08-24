import { afterEach, describe, expect, test } from "bun:test";
import nextConfig from "./next.config";

const rewrites = () => {
  if (!nextConfig.rewrites) throw new Error("rewrites are not configured");
  return nextConfig.rewrites();
};

describe("API proxy", () => {
  afterEach(() => delete process.env.API_PROXY_TARGET);

  test("keeps API calls on the web origin", async () => {
    process.env.API_PROXY_TARGET = "https://lastmile-api.vercel.app";

    expect(await rewrites()).toEqual([
      {
        source: "/backend/:path*",
        destination: "https://lastmile-api.vercel.app/:path*",
      },
    ]);
  });

  test("stays disabled for local development", async () => {
    expect(await rewrites()).toEqual([]);
  });
});
