"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import AddressAutocomplete from "@/components/address-autocomplete";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtKg, fmtMoney } from "@/lib/format";
import type { PlaceSelection } from "@/lib/geocode";
import type { ChargeBreakdown } from "@lastmile/shared";

interface AreaRow {
  id: string; name: string; pincode: string; city: string; zoneName: string;
}

/** Quote endpoint returns the full engine snapshot (superset of ChargeBreakdown). */
type QuoteData = ChargeBreakdown & Partial<{
  pickupZoneName: string; dropZoneName: string; intraZone: boolean;
}>;

const VOL_DIVISOR = 5000; // mirrors apps/api/src/lib/pricing.ts

const num = (s: string | number) => Number(s) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

const PRESETS = [
  { label: "Document", lengthCm: "35", breadthCm: "25", heightCm: "2", actualWeightKg: "0.5" },
  { label: "Small box", lengthCm: "30", breadthCm: "20", heightCm: "10", actualWeightKg: "2" },
  { label: "Medium box", lengthCm: "40", breadthCm: "30", heightCm: "20", actualWeightKg: "5" },
  { label: "Large box", lengthCm: "50", breadthCm: "40", heightCm: "30", actualWeightKg: "10" },
];

export default function NewOrder() {
  const router = useRouter();
  const { data: areaData } = useSWR<{ areas: AreaRow[] }>("areas", () => api("/orders/meta/areas"));

  const [form, setForm] = useState({
    pickupAreaId: "", dropAreaId: "",
    pickupName: "", pickupPhone: "", pickupLine1: "",
    dropName: "", dropPhone: "", dropLine1: "",
    lengthCm: "30", breadthCm: "20", heightCm: "10",
    actualWeightKg: "2",
    orderType: "B2C" as "B2B" | "B2C",
    paymentType: "PREPAID" as "PREPAID" | "COD",
    codAmount: "",
  });
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Non-serviceable pincode warnings, keyed per end of the route. */
  const [areaWarns, setAreaWarns] = useState<{ pickup: string | null; drop: string | null }>({ pickup: null, drop: null });

  const areas = areaData?.areas ?? [];
  const pickupArea = areas.find((a) => a.id === form.pickupAreaId);
  const dropArea = areas.find((a) => a.id === form.dropAreaId);

  // ── Google address pick → fill line1 + auto-match area by pincode ─────────
  function applyPlace(end: "pickup" | "drop", sel: PlaceSelection) {
    const match = sel.pincode ? areas.find((a) => a.pincode === sel.pincode) : undefined;
    const warn = match
      ? null
      : sel.pincode
        ? `We don't serve ${sel.pincode} yet — try another nearby address or pick the area manually.`
        : "No pincode detected for that address — pick an area manually below.";
    if (end === "pickup") {
      setForm((f) => ({ ...f, pickupLine1: sel.line1, pickupAreaId: match?.id ?? "" }));
      setAreaWarns((w) => ({ ...w, pickup: warn }));
    } else {
      setForm((f) => ({ ...f, dropLine1: sel.line1, dropAreaId: match?.id ?? "" }));
      setAreaWarns((w) => ({ ...w, drop: warn }));
    }
  }

  function clearWarn(end: "pickup" | "drop") {
    setAreaWarns((w) => ({ ...w, [end]: null }));
  }

  // Areas grouped by zone for scannable dropdowns
  const zoneGroups = useMemo(() => {
    const map = new Map<string, { city: string; areas: AreaRow[] }>();
    for (const a of areas) {
      const g = map.get(a.zoneName) ?? { city: a.city, areas: [] };
      g.areas.push(a);
      map.set(a.zoneName, g);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [areas]);

  // ── Live quote — debounced recalculation as inputs change ─────────────────
  const quoteKey = useMemo(
    () =>
      form.pickupAreaId && form.dropAreaId
        ? JSON.stringify([form.pickupAreaId, form.dropAreaId, form.lengthCm, form.breadthCm, form.heightCm, form.actualWeightKg, form.orderType, form.paymentType, form.codAmount])
        : null,
    [form],
  );

  useEffect(() => {
    if (!quoteKey) return;
    setQuoting(true);
    setQuoteErr(null);
    const t = setTimeout(async () => {
      try {
        const body = {
          pickupAreaId: form.pickupAreaId,
          dropAreaId: form.dropAreaId,
          lengthCm: num(form.lengthCm),
          breadthCm: num(form.breadthCm),
          heightCm: num(form.heightCm),
          actualWeightKg: num(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
          codAmount: form.paymentType === "COD" ? num(form.codAmount || 0) : undefined,
        };
        const res = await api<{ quote: QuoteData }>("/orders/quote", { method: "POST", body });
        setQuote(res.quote);
      } catch (e) {
        setQuote(null);
        setQuoteErr(e instanceof Error ? e.message : "Quote failed");
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  // ── Instant client-side weight preview (same ÷5000 rule as the engine) ────
  const l = num(form.lengthCm), b = num(form.breadthCm), h = num(form.heightCm);
  const actualKg = num(form.actualWeightKg);
  const dimsValid = l > 0 && b > 0 && h > 0;
  const volPreview = dimsValid ? round2((l * b * h) / VOL_DIVISOR) : 0;
  const weightReady = dimsValid && actualKg > 0;
  const billedOnVol = volPreview > actualKg;
  const slabLocal = Math.ceil(Math.max(actualKg, volPreview) * 2) / 2;

  // ── Completion state for step chips ───────────────────────────────────────
  const routeDone = [form.pickupAreaId, form.dropAreaId, form.pickupName, form.pickupPhone, form.pickupLine1, form.dropName, form.dropPhone, form.dropLine1].every(Boolean);
  const packageDone = weightReady;
  const confirmDone = !!quote;

  function swapEnds() {
    setForm((f) => ({
      ...f,
      pickupAreaId: f.dropAreaId, dropAreaId: f.pickupAreaId,
      pickupName: f.dropName, dropName: f.pickupName,
      pickupPhone: f.dropPhone, dropPhone: f.pickupPhone,
      pickupLine1: f.dropLine1, dropLine1: f.pickupLine1,
    }));
    setAreaWarns((w) => ({ pickup: w.drop, drop: w.pickup }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSubmitErr(null);
    try {
      const res = await api<{ order: { id: string } }>("/orders", {
        method: "POST",
        body: {
          pickupAreaId: form.pickupAreaId,
          dropAreaId: form.dropAreaId,
          lengthCm: num(form.lengthCm),
          breadthCm: num(form.breadthCm),
          heightCm: num(form.heightCm),
          actualWeightKg: num(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
          codAmount: form.paymentType === "COD" ? num(form.codAmount || 0) : undefined,
          pickup: { contactName: form.pickupName, contactPhone: form.pickupPhone, line1: form.pickupLine1, areaId: form.pickupAreaId },
          drop: { contactName: form.dropName, contactPhone: form.dropPhone, line1: form.dropLine1, areaId: form.dropAreaId },
        },
      });
      router.push(`/app/orders/${res.order.id}`);
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Could not place order");
      setBusy(false);
    }
  }

  return (
    <Shell role="CUSTOMER" title="LastMile">
      <header className="page-head order-page-head">
        <div>
          <p className="micro">Customer shipping</p>
          <h1>New shipment.</h1>
        </div>
        <ol className="flex flex-wrap gap-2 mt-3" aria-label="Progress">
          <StepChip n="01" label="Route" done={routeDone} target="step-route" />
          <StepChip n="02" label="Package & payment" done={packageDone} target="step-package" />
          <StepChip n="03" label="Confirm" done={confirmDone} target="step-confirm" />
        </ol>
      </header>

      <form id="new-order-form" onSubmit={submit} className="order-builder">
        <div className="order-fields">
          {submitErr && <ErrorNote error={submitErr} />}

          {/* ── 01 · Route ──────────────────────────────────────────────── */}
          <section id="step-route" className="order-section scroll-mt-20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <Micro>01 · Route</Micro>
                <h2 className="font-display font-bold text-lg mt-1">Pickup &amp; drop</h2>
              </div>
              <button type="button" onClick={swapEnds} className="btn btn-ghost btn-sm" title="Swap pickup and drop">
                ⇄ Swap
              </button>
            </div>

            <div className="relative grid lg:grid-cols-2 gap-6 lg:gap-12">
              <span aria-hidden className="hidden lg:block absolute left-1/2 top-2 bottom-2 -translate-x-1/2 border-l border-[var(--color-rule)]" />

              <fieldset className="space-y-4 min-w-0">
                <legend className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 grid place-items-center bg-[var(--color-signal)] text-[var(--color-ink)] font-mono text-[10px] font-bold">A</span>
                  <span className="micro !text-[var(--color-ink-2)]">Collect from</span>
                </legend>
                <Field label="Contact name">
                  <input className="field" required autoComplete="name" value={form.pickupName} onChange={(e) => setForm({ ...form, pickupName: e.target.value })} placeholder="Sender name" />
                </Field>
                <Field label="Contact phone">
                  <input className="field" type="tel" required autoComplete="tel" value={form.pickupPhone} onChange={(e) => setForm({ ...form, pickupPhone: e.target.value })} placeholder="+91…" />
                </Field>
                <AddressAutocomplete
                  id="pickup-address"
                  label="Pickup address"
                  required
                  value={form.pickupLine1}
                  onValueChange={(v) => setForm({ ...form, pickupLine1: v })}
                  onSelect={(sel) => applyPlace("pickup", sel)}
                  placeholder="Type a street, area or landmark…"
                />
                {pickupArea ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="status status-done">{pickupArea.zoneName}</span>
                    <Micro className="normal-case tracking-normal">Serving {pickupArea.name} · {pickupArea.pincode}</Micro>
                  </div>
                ) : areaWarns.pickup ? (
                  <p role="alert" className="text-[11px] leading-relaxed text-[var(--color-ink)] border-l-4 border-[var(--color-signal)] px-3 py-2 bg-[var(--color-subtle)]">
                    ⚠ {areaWarns.pickup}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--color-ink-3)] leading-relaxed">
                    Pick a suggestion — we resolve your serviceable area from its pincode.
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer select-none w-fit font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors">
                    Or choose area manually
                  </summary>
                  <Field label="Serviceable area">
                    <select className="field mt-2" value={form.pickupAreaId} onChange={(e) => { setForm({ ...form, pickupAreaId: e.target.value }); clearWarn("pickup"); }}>
                      <option value="">Select area…</option>
                      {zoneGroups.map(([zone, g]) => (
                        <optgroup key={zone} label={`${zone} · ${g.city}`}>
                          {g.areas.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} · {a.pincode}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                </details>
              </fieldset>

              <fieldset className="space-y-4 min-w-0">
                <legend className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 grid place-items-center border border-[var(--color-ink)] font-mono text-[10px] font-bold">B</span>
                  <span className="micro !text-[var(--color-ink-2)]">Deliver to</span>
                </legend>
                <Field label="Contact name">
                  <input className="field" required value={form.dropName} onChange={(e) => setForm({ ...form, dropName: e.target.value })} placeholder="Consignee name" />
                </Field>
                <Field label="Contact phone">
                  <input className="field" type="tel" required value={form.dropPhone} onChange={(e) => setForm({ ...form, dropPhone: e.target.value })} placeholder="+91…" />
                </Field>
                <AddressAutocomplete
                  id="drop-address"
                  label="Drop address"
                  required
                  value={form.dropLine1}
                  onValueChange={(v) => setForm({ ...form, dropLine1: v })}
                  onSelect={(sel) => applyPlace("drop", sel)}
                  placeholder="Type a street, area or landmark…"
                />
                {dropArea ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="status status-done">{dropArea.zoneName}</span>
                    <Micro className="normal-case tracking-normal">Serving {dropArea.name} · {dropArea.pincode}</Micro>
                  </div>
                ) : areaWarns.drop ? (
                  <p role="alert" className="text-[11px] leading-relaxed text-[var(--color-ink)] border-l-4 border-[var(--color-signal)] px-3 py-2 bg-[var(--color-subtle)]">
                    ⚠ {areaWarns.drop}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--color-ink-3)] leading-relaxed">
                    Pick a suggestion — we resolve your serviceable area from its pincode.
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer select-none w-fit font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors">
                    Or choose area manually
                  </summary>
                  <Field label="Serviceable area">
                    <select className="field mt-2" value={form.dropAreaId} onChange={(e) => { setForm({ ...form, dropAreaId: e.target.value }); clearWarn("drop"); }}>
                      <option value="">Select area…</option>
                      {zoneGroups.map(([zone, g]) => (
                        <optgroup key={zone} label={`${zone} · ${g.city}`}>
                          {g.areas.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} · {a.pincode}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                </details>
              </fieldset>
            </div>
          </section>

          {/* ── 02 · Package & payment ──────────────────────────────────── */}
          <section id="step-package" className="order-section scroll-mt-20">
            <Micro>02 · Package &amp; payment</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-4">What are we shipping?</h2>

            {/* Size presets */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="micro mr-1">Quick pick</span>
              {PRESETS.map((p) => {
                const active = p.lengthCm === form.lengthCm && p.breadthCm === form.breadthCm && p.heightCm === form.heightCm && p.actualWeightKg === form.actualWeightKg;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setForm({ ...form, lengthCm: p.lengthCm, breadthCm: p.breadthCm, heightCm: p.heightCm, actualWeightKg: p.actualWeightKg })}
                    className={`font-mono text-[11px] tracking-[0.06em] uppercase px-3 py-1.5 border transition-colors ${
                      active
                        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                        : "border-[var(--color-line-2)] text-[var(--color-ink-2)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Length (cm)"><input className="field" type="number" inputMode="decimal" step="0.1" min="0.1" required value={form.lengthCm} onChange={(e) => setForm({ ...form, lengthCm: e.target.value })} /></Field>
              <Field label="Breadth (cm)"><input className="field" type="number" inputMode="decimal" step="0.1" min="0.1" required value={form.breadthCm} onChange={(e) => setForm({ ...form, breadthCm: e.target.value })} /></Field>
              <Field label="Height (cm)"><input className="field" type="number" inputMode="decimal" step="0.1" min="0.1" required value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} /></Field>
              <Field label="Actual weight (kg)"><input className="field" type="number" inputMode="decimal" step="0.01" min="0.01" required value={form.actualWeightKg} onChange={(e) => setForm({ ...form, actualWeightKg: e.target.value })} /></Field>
            </div>

            {/* Instant weight explainer — same ÷5000 rule as the engine */}
            {weightReady && (
              <div className="weight-check">
                <div className="flex items-center justify-between gap-3">
                  <Micro>Weight check · L×B×H ÷ {VOL_DIVISOR}</Micro>
                  <span className={`status ${billedOnVol ? "status-live" : "status-done"}`}>
                    {billedOnVol ? "Billed on volumetric" : "Billed on actual"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <WeightBar label="Actual" kg={actualKg} max={Math.max(actualKg, volPreview)} winner={!billedOnVol} />
                  <WeightBar label="Volumetric" kg={volPreview} max={Math.max(actualKg, volPreview)} winner={billedOnVol} />
                </div>
                <p className="text-xs text-[var(--color-ink-2)] mt-3 leading-relaxed">
                  {billedOnVol
                    ? <>This box is bulky for its weight, so charges apply on volumetric weight — <strong className="font-mono">{fmtKg(slabLocal)}</strong> after rounding up to the next ½ kg.</>
                    : <>Charges apply on the physical weight — <strong className="font-mono">{fmtKg(slabLocal)}</strong> after rounding up to the next ½ kg.</>}
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4 mt-5">
              <Field label="Order type">
                <Segmented
                  value={form.orderType}
                  onChange={(v) => setForm({ ...form, orderType: v as "B2B" | "B2C" })}
                  options={[["B2C", "Direct to consumer"], ["B2B", "Business consignment"]]}
                />
              </Field>
              <Field label="Payment">
                <Segmented
                  value={form.paymentType}
                  onChange={(v) => setForm({ ...form, paymentType: v as "PREPAID" | "COD" })}
                  options={[["PREPAID", "Prepaid"], ["COD", "Cash on delivery"]]}
                />
              </Field>
              {form.paymentType === "COD" && (
                <Field label="COD amount (₹)">
                  <input className="field" type="number" inputMode="decimal" step="0.01" min="0.01" required value={form.codAmount} onChange={(e) => setForm({ ...form, codAmount: e.target.value })} placeholder="Collect at door" />
                </Field>
              )}
            </div>
            {form.paymentType === "COD" && (
              <p className="micro mt-3 normal-case tracking-normal">A COD surcharge (% of amount + flat fee) is added by the rate engine — see the live quote.</p>
            )}
          </section>
        </div>

        {/* ── 03 · Live quote ─────────────────────────────────────────── */}
        <aside id="step-confirm" className="quote-panel scroll-mt-20">
          <div className="quote-card">
            <div className="flex items-center justify-between border-b border-[var(--color-ink)] pb-3">
              <Micro>03 · Live quote · rate engine</Micro>
              {quoting && <span className="w-3.5 h-3.5 border-2 border-[var(--color-signal)] border-t-transparent rounded-full animate-spin" />}
            </div>

            {!form.pickupAreaId || !form.dropAreaId ? (
              <p className="text-sm text-[var(--color-ink-3)] py-8 text-center">Select pickup and drop areas to see the charge.</p>
            ) : quoteErr ? (
              <div className="py-5"><ErrorNote error={quoteErr} /></div>
            ) : quote ? (
              <>
                {(quote.pickupZoneName || quote.dropZoneName) && (
                  <div className="flex items-center gap-2 flex-wrap pt-4">
                    <span className="meta-chip">{quote.pickupZoneName ?? "Pickup"}</span>
                    <span aria-hidden className="route-line w-6 shrink-0" />
                    <span className="meta-chip">{quote.dropZoneName ?? "Drop"}</span>
                    {quote.intraZone && <span className="status status-hold">Intra-zone</span>}
                  </div>
                )}

                {/* Billable weight story */}
                <div className="py-4 border-b border-[var(--color-rule)]">
                  <div className="flex items-baseline justify-between">
                    <Micro>Billable weight</Micro>
                    <span className="micro normal-case tracking-normal">rounded up to ½ kg</span>
                  </div>
                  <div className="font-mono font-semibold text-xl mt-1 tabular-nums">{fmtKg(quote.billableWeightKg)}</div>
                  <div className="mt-2.5 space-y-1.5">
                    <WeightBar label="Actual" kg={actualKg} max={Math.max(actualKg, quote.volumetricWeightKg)} winner={actualKg >= quote.volumetricWeightKg} />
                    <WeightBar label="Volumetric" kg={quote.volumetricWeightKg} max={Math.max(actualKg, quote.volumetricWeightKg)} winner={quote.volumetricWeightKg > actualKg} />
                  </div>
                  <p className="text-xs text-[var(--color-ink-3)] mt-2.5 leading-relaxed">
                    Charged on whichever is higher — bulky-but-light boxes bill on volumetric (L×B×H ÷ {VOL_DIVISOR}).
                  </p>
                </div>

                {/* Charges */}
                <dl className="py-4 space-y-2.5 font-mono text-sm">
                  <Row k="Rate card" v={quote.rateCardName ?? "—"} small />
                  <Row k="Base price" v={fmtMoney(quote.basePrice)} />
                  {quote.chargeableWeightKg > 0 ? (
                    <Row k={`+ ${quote.chargeableWeightKg} kg × ${fmtMoney(quote.perKgRate)}/kg`} v={fmtMoney(round2(quote.chargeableWeightKg * quote.perKgRate))} />
                  ) : (
                    <Row k="Extra weight" v="none — within allowance" small />
                  )}
                  <Row k="Freight" v={fmtMoney(quote.freightCharge)} strong />
                  {quote.codSurcharge > 0 && <Row k="COD surcharge" v={fmtMoney(quote.codSurcharge)} />}
                </dl>
                <div className="quote-total">
                  <span className="micro">Total charge</span>
                  <span>{fmtMoney(quote.totalCharge)}</span>
                </div>
              </>
            ) : null}
          </div>

          <button type="submit" disabled={!quote || busy} className="btn btn-primary w-full hidden lg:inline-flex">
            {busy ? "Placing…" : `Confirm & place order${quote ? ` · ${fmtMoney(quote.totalCharge)}` : ""}`}
          </button>
          <p className="micro leading-relaxed hidden lg:block">The engine re-verifies this price server-side on submit — client figures are never trusted.</p>
        </aside>
      </form>

      {/* Mobile sticky confirm bar */}
      <div className="mobile-confirm">
        <div className="min-w-0">
          <Micro>Total</Micro>
          <div className="font-mono font-semibold text-lg tabular-nums leading-tight">{quote ? fmtMoney(quote.totalCharge) : "—"}</div>
        </div>
        <button type="submit" form="new-order-form" disabled={!quote || busy} className="btn btn-primary flex-1">
          {busy ? "Placing…" : "Confirm order"}
        </button>
      </div>
      <div aria-hidden className="h-20 lg:hidden" />
    </Shell>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function StepChip({ n, label, done, target }: { n: string; label: string; done: boolean; target: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        aria-label={`Jump to ${label}`}
        title={`Jump to ${label}`}
        className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] tracking-[0.07em] uppercase transition-colors cursor-pointer ${
          done
            ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-signal-deep)] hover:border-[var(--color-signal-deep)]"
            : "border-[var(--color-line-2)] text-[var(--color-ink-3)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        }`}
      >
        <span>{n}</span>
        <span className="opacity-50">·</span>
        <span>{label}</span>
        {done && <span aria-hidden>✓</span>}
      </button>
    </li>
  );
}

function Segmented({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 border border-[var(--color-rule)] bg-[var(--color-subtle)]" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`px-2 py-1.5 font-mono text-[11px] tracking-[0.06em] uppercase transition-colors ${
            value === v
              ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
              : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          }`}
          title={label}
        >
          {v === "PREPAID" ? "Prepaid" : v}
        </button>
      ))}
    </div>
  );
}

function WeightBar({ label, kg, max, winner }: { label: string; kg: number; max: number; winner: boolean }) {
  const pct = max > 0 ? Math.max(4, Math.min(100, (kg / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`font-mono text-[10.5px] tracking-[0.1em] uppercase w-20 shrink-0 ${winner ? "text-[var(--color-ink)]" : "text-[var(--color-ink-3)]"}`}>
        {label}
      </span>
      <span className="flex-1 h-2 bg-[var(--color-subtle)] overflow-hidden">
        <span
          className={`block h-full transition-all duration-300 ${winner ? "bg-[var(--color-signal)]" : "bg-[var(--color-line-2)]"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={`font-mono text-xs tabular-nums w-16 text-right ${winner ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-3)]"}`}>
        {fmtKg(kg)}
      </span>
    </div>
  );
}

function Row({ k, v, strong, small }: { k: string; v: string; strong?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[var(--color-ink-3)] ${small ? "text-xs" : ""}`}>{k}</dt>
      <dd className={`${strong ? "font-semibold" : ""} ${small ? "text-xs text-right" : "text-right"} tabular-nums`}>{v}</dd>
    </div>
  );
}
