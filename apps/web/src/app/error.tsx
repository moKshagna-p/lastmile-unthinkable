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
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card p-8 max-w-md w-full text-center rise">
        <p className="micro !text-[var(--color-stop)]">Exception · 500</p>
        <h1 className="font-display font-bold text-2xl tracking-tight mt-2">Something broke in transit</h1>
        <p className="text-sm text-[var(--color-ink-2)] mt-3 leading-relaxed">
          An unexpected error occurred. The details are in the browser console.
        </p>
        {error.digest && (
          <p className="micro mt-3 font-mono normal-case tracking-normal">digest · {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <a href="/" className="btn btn-ghost">Back home</a>
        </div>
      </div>
    </main>
  );
}
