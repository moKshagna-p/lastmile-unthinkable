import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="card p-8 max-w-md w-full text-center rise">
        <p className="micro !text-[var(--color-signal)]">Unrouted · 404</p>
        <h1 className="font-display font-bold text-2xl tracking-tight mt-2">No waybill at this address</h1>
        <p className="text-sm text-[var(--color-ink-2)] mt-3 leading-relaxed">
          The page you asked for isn&rsquo;t on the manifest. Check the URL or head back to the console.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          <Link href="/" className="btn btn-primary">Back home</Link>
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        </div>
      </div>
    </main>
  );
}
