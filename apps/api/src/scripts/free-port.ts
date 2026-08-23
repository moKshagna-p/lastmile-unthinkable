/**
 * Frees the API port from stale listeners left behind by previous sessions
 * (closed terminals, hot-reload crashes) so a fresh boot never dies with
 * EADDRINUSE.
 *
 * Runs in two ways:
 *  • imported + awaited by src/index.ts before binding — covers every launch
 *    path, including the raw `bun --hot src/index.ts`
 *  • standalone via `bun run src/scripts/free-port.ts` (import.meta.main)
 *
 * Order of operations: SIGTERM first (lets an old server release its socket
 * cleanly), brief grace period, then SIGKILL for anything still hanging on.
 * Skipped entirely in production — never kill unknown listeners there. If
 * lsof is unavailable or the port is free, this resolves instantly; the
 * EADDRINUSE fail-fast in index.ts remains as a last-resort guard.
 */

export async function freePort(port: number): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const listeners = (): string[] => {
    try {
      const proc = Bun.spawnSync(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
      return proc.stdout.toString().split("\n").map((s) => s.trim()).filter(Boolean);
    } catch {
      return []; // lsof missing/non-macOS — skip; index.ts fail-fast still guards
    }
  };

  const stale = listeners();
  if (stale.length === 0) return;

  console.log(`♻ Port ${port} was held by ${stale.join(", ")} — freeing…`);
  Bun.spawnSync(["kill", ...stale]);

  await new Promise((resolve) => setTimeout(resolve, 300));
  const survivors = listeners();
  if (survivors.length > 0) {
    Bun.spawnSync(["kill", "-9", ...survivors]);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

if (import.meta.main) await freePort(Number(process.env.API_PORT ?? 4000));
