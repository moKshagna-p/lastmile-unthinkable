"use client";

import { useEffect } from "react";

/** Route-level error boundary — keeps failures inside the shell's visual language. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="state-page">
      <div className="state-mark">500</div>
      <div className="state-copy">
        <a href="/" className="brand-wordmark">LASTMILE</a>
        <p className="micro !text-[var(--color-stop)] mt-12">Application exception</p>
        <h1>Something broke<br />in transit.</h1>
        <p>
          An unexpected error occurred. The details are in the browser console.
        </p>
        {error.digest && (
          <p className="micro mt-3 font-mono normal-case tracking-normal">digest · {error.digest}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <a href="/" className="btn btn-ghost">Back home</a>
        </div>
      </div>
    </main>
  );
}
