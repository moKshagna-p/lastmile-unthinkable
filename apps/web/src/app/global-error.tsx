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
      <body style={{ background: "#f6f4ee", color: "#17140e", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div
            style={{
              background: "#fffdf8",
              border: "1px solid #ddd8ca",
              borderRadius: 4,
              padding: 32,
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
            }}
          >
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b3261e" }}>
              Critical · Application fault
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>The console hit a wall</h1>
            <p style={{ fontSize: 14, color: "#4a463c", marginTop: 10, lineHeight: 1.6 }}>
              A critical rendering error occurred. Restarting the page usually clears it.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 22,
                padding: "10px 18px",
                background: "#e8500a",
                color: "#fff",
                border: "none",
                borderRadius: 3,
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
