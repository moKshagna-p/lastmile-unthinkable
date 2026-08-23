import Link from "next/link";
import { ArrowUpRight, Bike, Check, Package, SlidersHorizontal } from "lucide-react";

const MOVEMENTS = [
  ["LM-2026-00042", "Indiranagar → Whitefield", "In transit"],
  ["LM-2026-00041", "MG Road → HSR Layout", "Delivered"],
  ["LM-2026-00040", "Koramangala → Jayanagar", "Assigned"],
];

export default function Landing() {
  return (
    <main className="public-site">
      <header className="public-nav">
        <Link href="/" className="brand-wordmark" aria-label="LastMile home">LASTMILE</Link>
        <nav aria-label="Account">
          <Link href="/login" className="btn btn-ghost">Log in</Link>
          <Link href="/register" className="btn btn-primary">Start shipping <ArrowUpRight size={14} /></Link>
        </nav>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="micro">Bengaluru delivery operations / B2B + B2C</p>
          <h1>Delivery,<br />without the<br /><span>blind spots.</span></h1>
          <p className="public-deck">
            Price, dispatch and follow every shipment from pickup to doorstep—without losing the human behind the handoff.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/register" className="btn btn-primary">Place an order <ArrowUpRight size={14} /></Link>
            <Link href="/login" className="btn btn-outline">Open your console</Link>
          </div>
        </div>

        <div className="network-proof" aria-label="Live network example">
          <div className="network-proof-head">
            <span>LIVE NETWORK</span>
            <span>24 AUG / 09:42</span>
          </div>
          <div className="network-score">
            <div><strong>128</strong><span>parcels moving</span></div>
            <div className="signal-block"><span>ON TIME</span><strong>96.2%</strong><small>↑ 2.4% this week</small></div>
          </div>
          <div className="movement-list">
            <div className="movement movement-head"><span>Waybill</span><span>Route</span><span>Status</span></div>
            {MOVEMENTS.map(([code, route, status], index) => (
              <div className="movement" key={code}>
                <strong>{code}</strong><span>{route}</span><span className={index === 0 ? "movement-live" : ""}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-proof" aria-label="Platform proof">
        <div><strong>01</strong><h2>Price before pickup</h2><p>Zone-aware rates, volumetric weight and COD charges are clear before you confirm.</p></div>
        <div><strong>02</strong><h2>Dispatch with context</h2><p>Availability, capacity and distance point each shipment to the right rider.</p></div>
        <div><strong>03</strong><h2>Track every handoff</h2><p>An append-only journey records who moved the parcel, where and when.</p></div>
      </section>

      <section className="public-workflow">
        <div>
          <p className="micro">One network / three focused views</p>
          <h2>Built around the work,<br />not around a dashboard.</h2>
        </div>
        <div className="role-list">
          <article><Package /><div><h3>Customer</h3><p>Book with an upfront quote, follow the live route, reschedule when life changes.</p></div><Link href="/register" aria-label="Create customer account"><ArrowUpRight /></Link></article>
          <article><SlidersHorizontal /><div><h3>Operations</h3><p>Own pricing, zones, rider capacity and exceptions from one precise control surface.</p></div><Link href="/login" aria-label="Open operations console"><ArrowUpRight /></Link></article>
          <article><Bike /><div><h3>Rider</h3><p>See the address, collect COD and confirm the next valid scan without distraction.</p></div><Link href="/login" aria-label="Open rider console"><ArrowUpRight /></Link></article>
        </div>
      </section>

      <section className="public-cta">
        <div><Check size={18} /><span>Configurable rates</span></div>
        <div><Check size={18} /><span>Nearest-rider dispatch</span></div>
        <div><Check size={18} /><span>Immutable tracking</span></div>
        <Link href="/register" className="btn btn-primary">Move your first parcel <ArrowUpRight size={14} /></Link>
      </section>

      <footer className="public-footer"><span className="brand-wordmark">LASTMILE</span><span>DELIVERY OPERATIONS / BENGALURU</span></footer>
    </main>
  );
}
