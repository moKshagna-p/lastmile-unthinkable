"use client";

/**
 * Root error boundary — renders when the layout itself fails.
 * Must own <html>/<body> since the root layout is bypassed here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#f0f1ec", color: "#0a0b0a", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
          <div style={{ display: "grid", placeItems: "center", background: "#0a0b0a", color: "#38ff62", fontSize: "clamp(80px, 18vw, 240px)", fontWeight: 900, letterSpacing: "-0.08em" }}>500</div>
          <div
            style={{
              padding: "clamp(28px, 8vw, 96px)",
              alignSelf: "center",
            }}
          >
            <strong style={{ fontSize: 22, letterSpacing: "-0.06em" }}>LASTMILE</strong>
            <p style={{ marginTop: 72, fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#d64032" }}>
              Critical application fault
            </p>
            <h1 style={{ fontSize: 48, lineHeight: 0.95, letterSpacing: "-0.06em", marginTop: 12 }}>The console<br />hit a wall.</h1>
            <p style={{ fontSize: 14, color: "#626760", marginTop: 18, lineHeight: 1.6, maxWidth: 420 }}>
              A critical rendering error occurred. Restarting the page usually clears it.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 22,
                padding: "10px 18px",
                background: "#38ff62",
                color: "#0a0b0a",
                border: "1px solid #0a0b0a",
                borderRadius: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
