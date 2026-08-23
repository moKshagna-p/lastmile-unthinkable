import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <div className="state-mark">404</div>
      <div className="state-copy">
        <Link href="/" className="brand-wordmark">LASTMILE</Link>
        <p className="micro mt-12">Unrouted address</p>
        <h1>No waybill<br />at this address.</h1>
        <p>
          The page you asked for isn&rsquo;t on the manifest. Check the URL or head back to the console.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/" className="btn btn-primary">Back home</Link>
          <Link href="/login" className="btn btn-ghost">Log in</Link>
        </div>
      </div>
    </main>
  );
}
