import Link from "next/link";
import { ArrowRight, Boxes, MapPin, Radar, Route, ShieldCheck, Siren } from "lucide-react";
import { Barcode } from "@/components/ui";

const FEATURES = [
  {
    icon: Route,
    kicker: "01 / Pricing",
    title: "Rate engine, zero hardcoding",
    body: "Pincode → zone detection, volumetric weight (L×B×H ÷ 5000), billable on the higher slab, B2B/B2C rate cards per zone pair, COD surcharge — all admin-configured, quoted before you confirm.",
  },
  {
    icon: Radar,
    kicker: "02 / Dispatch",
    title: "Nearest-agent auto assignment",
    body: "Agents carry a live position and capacity. Dispatch scores availability, zone affinity and distance — or an admin pins a specific rider manually.",
  },
  {
    icon: Boxes,
    kicker: "03 / Lifecycle",
    title: "Immutable tracking history",
    body: "Every scan — Picked Up, In Transit, Out for Delivery, Delivered, Failed — is appended to an append-only ledger with actor and timestamp. The database itself refuses tampering.",
  },
  {
    icon: Siren,
    kicker: "04 / Recovery",
    title: "Failed-delivery recovery",
    body: "A failed attempt notifies the customer instantly. They pick a new date; the system reassigns a fresh agent for the retry — automatically.",
  },
];

const MARQUEE = [
  "PLACED", "ASSIGNED", "PICKED UP", "IN TRANSIT", "OUT FOR DELIVERY", "DELIVERED", "FAILED → RESCHEDULED",
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 bg-[var(--color-signal)] text-white grid place-items-center rounded-[3px] font-display font-bold text-sm">L</span>
            <span className="font-display font-bold tracking-tight text-lg">LastMile</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">Log in</Link>
            <Link href="/register" className="btn btn-primary">Start shipping</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-14 items-start">
          <div>
            <p className="micro rise">Delivery operations platform · B2B + B2C</p>
            <h1 className="rise rise-1 font-display font-bold text-[clamp(44px,7vw,84px)] leading-[0.95] tracking-tight mt-4">
              Every parcel.
              <br />
              <span className="text-[var(--color-signal)]">Accounted for.</span>
            </h1>
            <p className="rise rise-2 mt-6 text-lg text-[var(--color-ink-2)] max-w-xl leading-relaxed">
              Quote, dispatch and track shipments across zones with a configurable
              rate engine, nearest-rider assignment and an audit-proof status
              ledger — from pickup scan to doorstep.
            </p>
            <div className="rise rise-3 flex flex-wrap gap-3 mt-8">
              <Link href="/register" className="btn btn-primary">
                Place your first order <ArrowRight size={15} />
              </Link>
              <Link href="/login" className="btn btn-outline">Explore the console</Link>
            </div>

            {/* Spec strip */}
            <div className="rise rise-4 mt-8 flex items-center gap-4 flex-wrap">
              {["Zone-aware pricing", "Nearest-rider dispatch", "Immutable scan ledger"].map((s) => (
                <span key={s} className="flex items-center gap-4">
                  <span className="micro !text-[var(--color-ink-2)]">{s}</span>
                  <span aria-hidden className="route-dash w-10" />
                </span>
              ))}
            </div>

            {/* Demo credentials */}
            <div className="rise rise-4 card mt-10 p-5 max-w-xl">
              <p className="micro mb-3">Demo accounts · password <span className="font-mono text-[var(--color-ink)]">Password@123</span></p>
              <div className="grid sm:grid-cols-3 gap-3 font-mono text-xs">
                {[
                  ["ADMIN", "admin@lastmile.dev"],
                  ["CUSTOMER", "customer@lastmile.dev"],
                  ["AGENT", "vikram@lastmile.dev"],
                ].map(([role, email]) => (
                  <div key={role} className="border border-[var(--color-line)] rounded p-3">
                    <div className="micro mb-1">{role}</div>
                    <div className="text-[var(--color-ink)] break-all">{email}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Waybill card */}
          <div className="rise rise-2 lg:sticky lg:top-8">
            <div className="card p-6 rotate-[0.6deg]">
              <div className="flex items-center justify-between border-b border-dashed border-[var(--color-line-2)] pb-4">
                <div>
                  <p className="micro">Waybill</p>
                  <p className="font-mono font-semibold text-lg">LM-2026-00042</p>
                </div>
                <span className="stamp stamp-signal">In Transit</span>
              </div>
              <div className="py-5">
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-[var(--color-go)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Indiranagar · 560038</p>
                    <p className="micro">Central Bengaluru</p>
                  </div>
                </div>
                <div className="route-dash my-3 ml-[7px] w-[calc(100%-30px)]" />
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-[var(--color-signal)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Whitefield · 560066</p>
                    <p className="micro">East Bengaluru</p>
                  </div>
                </div>
              </div>
              <dl className="border-t border-dashed border-[var(--color-line-2)] pt-4 grid grid-cols-2 gap-y-3 font-mono text-sm">
                <dt className="micro self-center">Volumetric</dt><dd className="text-right">12.80 kg</dd>
                <dt className="micro self-center">Billable</dt><dd className="text-right font-semibold">13.00 kg</dd>
                <dt className="micro self-center">Freight</dt><dd className="text-right">₹645.00</dd>
                <dt className="micro self-center">COD surcharge</dt><dd className="text-right">₹150.00</dd>
                <dt className="micro self-center text-[var(--color-signal)]">Total</dt>
                <dd className="text-right font-semibold text-[var(--color-signal)]">₹795.00</dd>
              </dl>
              <div className="mt-5 pt-4 border-t border-dashed border-[var(--color-line-2)] flex items-end justify-between gap-4">
                <Barcode value="LM-2026-00042" className="h-9 w-40 text-[var(--color-ink)]" />
                <span className="micro !text-[var(--color-ink-3)] shrink-0">Shipper&rsquo;s copy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Status marquee */}
      <section className="marquee border-y border-[var(--color-line)] bg-[var(--color-paper-2)] overflow-hidden py-3">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((s, i) => (
            <span key={i} className="mx-6 font-mono text-xs tracking-[0.18em] uppercase text-[var(--color-ink-2)] whitespace-nowrap">
              {s} <span className="text-[var(--color-signal)] mx-3">→</span>
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tight max-w-lg">
          Built like infrastructure, not like a demo.
        </h2>
        <div className="grid md:grid-cols-2 gap-px bg-[var(--color-line)] border border-[var(--color-line)] rounded-md overflow-hidden mt-10">
          {FEATURES.map((f) => (
            <article key={f.kicker} className="bg-[#fffdf8] p-8 hover:bg-white transition-colors group">
              <div className="flex items-center justify-between">
                <f.icon size={22} strokeWidth={1.75} className="text-[var(--color-signal)] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110" />
                <span className="micro">{f.kicker}</span>
              </div>
              <h3 className="font-display font-bold text-xl mt-5 tracking-tight">{f.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-[var(--color-ink-2)] mt-2">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { role: "Customer", body: "Register, place orders with upfront pricing, watch the live timeline, reschedule failed attempts.", href: "/register", cta: "Create account" },
            { role: "Admin", body: "Own the network: zones & pincode mapping, rate cards, COD surcharges, agents, overrides.", href: "/login", cta: "Open console" },
            { role: "Agent", body: "A focused run sheet: today's deliveries, one-tap scans, failure reasons, live location pings.", href: "/login", cta: "Go on duty" },
          ].map((r) => (
            <div key={r.role} className="card p-6 flex flex-col group">
              <ShieldCheck size={18} className="text-[var(--color-ink-3)]" />
              <h3 className="font-display font-bold text-lg mt-3">{r.role}</h3>
              <p className="text-sm text-[var(--color-ink-2)] leading-relaxed mt-1.5 flex-1">{r.body}</p>
              <Link href={r.href} className="btn btn-ghost mt-5 self-start">
                {r.cta} <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="w-5 h-5 bg-[var(--color-signal)] text-white grid place-items-center rounded-[3px] font-display font-bold text-[10px]">L</span>
            <span className="micro">LastMile · unthinkable build</span>
          </span>
          <span className="micro">Bun · Next.js · Postgres</span>
        </div>
      </footer>
    </main>
  );
}
