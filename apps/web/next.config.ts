import type { NextConfig } from "next";
import path from "node:path";

/**
 * Pin the workspace root explicitly — otherwise Next.js walks up and may pick
 * a parent directory's lockfile (e.g. an unrelated bun.lock) and warn.
 * Next always runs with cwd = the app dir, so the repo root is two levels up.
 */
const workspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@lastmile/shared"],
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
