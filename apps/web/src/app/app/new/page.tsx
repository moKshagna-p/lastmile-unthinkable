"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtKg, fmtMoney } from "@/lib/format";
import type { ChargeBreakdown } from "@lastmile/shared";

interface AreaRow {
  id: string; name: string; pincode: string; city: string; zoneName: string;
}

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
  const [quote, setQuote] = useState<ChargeBreakdown | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const areas = areaData?.areas ?? [];

  // Live quote — debounced recalculation as inputs change
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
          lengthCm: Number(form.lengthCm),
          breadthCm: Number(form.breadthCm),
          heightCm: Number(form.heightCm),
          actualWeightKg: Number(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
          codAmount: form.paymentType === "COD" ? Number(form.codAmount || 0) : undefined,
        };
        const res = await api<{ quote: ChargeBreakdown }>("/orders/quote", { method: "POST", body });
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
          lengthCm: Number(form.lengthCm),
          breadthCm: Number(form.breadthCm),
          heightCm: Number(form.heightCm),
          actualWeightKg: Number(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
          codAmount: form.paymentType === "COD" ? Number(form.codAmount || 0) : undefined,
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
      <div className="rise">
        <h1 className="font-display font-bold text-3xl tracking-tight">New shipment</h1>
        <p className="micro mt-1">Charges are computed by the rate engine — confirm only when the price looks right</p>
      </div>

      <form onSubmit={submit} className="grid lg:grid-cols-[1fr_380px] gap-6 mt-6 items-start">
        <div className="space-y-5">
          {/* Pickup */}
          <section className="card p-6 rise rise-1">
            <Micro>Pickup · A</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-4">Collect from</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact name">
                <input className="field" required value={form.pickupName} onChange={(e) => setForm({ ...form, pickupName: e.target.value })} placeholder="Sender name" />
              </Field>
              <Field label="Contact phone">
                <input className="field" required value={form.pickupPhone} onChange={(e) => setForm({ ...form, pickupPhone: e.target.value })} placeholder="+91…" />
              </Field>
              <Field label="Address line">
                <input className="field sm:col-span-2" required minLength={5} value={form.pickupLine1} onChange={(e) => setForm({ ...form, pickupLine1: e.target.value })} placeholder="Flat, street, landmark" />
              </Field>
              <Field label="Serviceable area (pincode → zone)">
                <select className="field" required value={form.pickupAreaId} onChange={(e) => setForm({ ...form, pickupAreaId: e.target.value })}>
                  <option value="">Select area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.pincode} — {a.zoneName}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Drop */}
          <section className="card p-6 rise rise-2">
            <Micro>Drop · B</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-4">Deliver to</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contact name">
                <input className="field" required value={form.dropName} onChange={(e) => setForm({ ...form, dropName: e.target.value })} placeholder="Consignee name" />
              </Field>
              <Field label="Contact phone">
                <input className="field" required value={form.dropPhone} onChange={(e) => setForm({ ...form, dropPhone: e.target.value })} placeholder="+91…" />
              </Field>
              <Field label="Address line">
                <input className="field sm:col-span-2" required minLength={5} value={form.dropLine1} onChange={(e) => setForm({ ...form, dropLine1: e.target.value })} placeholder="Flat, street, landmark" />
              </Field>
              <Field label="Serviceable area (pincode → zone)">
                <select className="field" required value={form.dropAreaId} onChange={(e) => setForm({ ...form, dropAreaId: e.target.value })}>
                  <option value="">Select area…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.pincode} — {a.zoneName}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Package + commercial */}
          <section className="card p-6 rise rise-3">
            <Micro>Package &amp; payment</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-4">What are we shipping?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Length (cm)"><input className="field" type="number" step="0.1" min="0.1" required value={form.lengthCm} onChange={(e) => setForm({ ...form, lengthCm: e.target.value })} /></Field>
              <Field label="Breadth (cm)"><input className="field" type="number" step="0.1" min="0.1" required value={form.breadthCm} onChange={(e) => setForm({ ...form, breadthCm: e.target.value })} /></Field>
              <Field label="Height (cm)"><input className="field" type="number" step="0.1" min="0.1" required value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} /></Field>
              <Field label="Actual weight (kg)"><input className="field" type="number" step="0.01" min="0.01" required value={form.actualWeightKg} onChange={(e) => setForm({ ...form, actualWeightKg: e.target.value })} /></Field>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <Field label="Order type">
                <select className="field" value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as "B2B" | "B2C" })}>
                  <option value="B2C">B2C — direct to consumer</option>
                  <option value="B2B">B2B — business consignment</option>
                </select>
              </Field>
              <Field label="Payment">
                <select className="field" value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value as "PREPAID" | "COD" })}>
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">Cash on delivery</option>
                </select>
              </Field>
              {form.paymentType === "COD" && (
                <Field label="COD amount (₹)">
                  <input className="field" type="number" step="0.01" min="0.01" required value={form.codAmount} onChange={(e) => setForm({ ...form, codAmount: e.target.value })} placeholder="Collect at door" />
                </Field>
              )}
            </div>
            {submitErr && <div className="mt-4"><ErrorNote error={submitErr} /></div>}
          </section>
        </div>

        {/* Quote panel */}
        <aside className="lg:sticky lg:top-20 space-y-4 rise rise-2">
          <div className="card p-6">
            <div className="flex items-center justify-between border-b border-dashed border-[var(--color-line-2)] pb-3">
              <Micro>Live quote · rate engine</Micro>
              {quoting && <span className="w-3.5 h-3.5 border-2 border-[var(--color-signal)] border-t-transparent rounded-full animate-spin" />}
            </div>

            {!form.pickupAreaId || !form.dropAreaId ? (
              <p className="text-sm text-[var(--color-ink-3)] py-8 text-center">Select pickup and drop areas to see the charge.</p>
            ) : quoteErr ? (
              <div className="py-5"><ErrorNote error={quoteErr} /></div>
            ) : quote ? (
              <>
                <dl className="py-4 space-y-2.5 font-mono text-sm">
                  <Row k="Volumetric (÷5000)" v={fmtKg(quote.volumetricWeightKg)} />
                  <Row k="Billable weight" v={fmtKg(quote.billableWeightKg)} strong />
                  <Row k="Rate card" v={quote.rateCardName ?? "—"} small />
                  <Row k={`Base (${quote.chargeableWeightKg > 0 ? "incl. first slab" : "flat"})`} v={fmtMoney(quote.basePrice)} />
                  {quote.chargeableWeightKg > 0 && (
                    <Row k={`+ ${quote.chargeableWeightKg} kg × ${fmtMoney(quote.perKgRate)}`} v={fmtMoney(quote.chargeableWeightKg * quote.perKgRate)} />
                  )}
                  <Row k="Freight" v={fmtMoney(quote.freightCharge)} />
                  {quote.codSurcharge > 0 && <Row k="COD surcharge" v={fmtMoney(quote.codSurcharge)} />}
                </dl>
                <div className="border-t-2 border-[var(--color-ink)] pt-3 flex items-baseline justify-between">
                  <span className="micro !text-[var(--color-signal)]">Total charge</span>
                  <span className="font-mono font-semibold text-2xl text-[var(--color-signal)] tabular-nums">{fmtMoney(quote.totalCharge)}</span>
                </div>
              </>
            ) : null}
          </div>

          <button type="submit" disabled={!quote || busy} className="btn btn-primary w-full">
            {busy ? "Placing…" : `Confirm & place order${quote ? ` · ${fmtMoney(quote.totalCharge)}` : ""}`}
          </button>
          <p className="micro leading-relaxed">The engine re-verifies this price server-side on submit — client figures are never trusted.</p>
        </aside>
      </form>
    </Shell>
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
