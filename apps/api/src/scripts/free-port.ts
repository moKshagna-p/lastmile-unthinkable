/**
 * Pre-flight for `bun run dev`: frees the API port from stale listeners left
 * behind by previous sessions (closed terminals, hot-reload crashes) so a
 * fresh `bun --hot src/index.ts` never dies with EADDRINUSE.
 *
 * Order of operations: SIGTERM first (lets the old server close its socket
 * cleanly), brief grace period, then SIGKILL for anything still hanging on.
 * If lsof is unavailable or the port is free, this exits instantly and the
 * normal boot proceeds. The EADDRINUSE fail-fast in index.ts remains as a
 * last-resort guard.
 */

export {}; // make this a module so top-level await typechecks

const port = Number(process.env.API_PORT ?? 4000);

function listeners(): string[] {
  try {
    const proc = Bun.spawnSync(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
    return proc.stdout.toString().split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return []; // lsof missing/non-macOS — skip; index.ts fail-fast still guards
  }
}

const stale = listeners();
if (stale.length === 0) process.exit(0);

console.log(`♻ Port ${port} was held by ${stale.join(", ")} — freeing…`);
Bun.spawnSync(["kill", ...stale]);

await new Promise((resolve) => setTimeout(resolve, 300));
const survivors = listeners();
if (survivors.length > 0) {
  Bun.spawnSync(["kill", "-9", ...survivors]);
  await new Promise((resolve) => setTimeout(resolve, 100));
}
