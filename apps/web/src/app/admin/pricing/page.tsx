"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

interface RateCard {
  id: string; name: string; fromZoneName: string; toZoneName: string;
  orderType: "B2B" | "B2C"; baseWeightKg: number; basePrice: number; perKgRate: number; active: boolean;
}
interface Cod { orderType: "B2B" | "B2C"; percent: number; flatFee: number; active: boolean }
interface Zone { id: string; name: string }

export default function PricingAdmin() {
  const cards = useSWR<{ rateCards: RateCard[] }>("rate-cards", () => api("/admin/rate-cards"));
  const cod = useSWR<{ codSurcharges: Cod[] }>("cod", () => api("/admin/cod-surcharges"));
  const zones = useSWR<{ zones: Zone[] }>("zones", () => api("/admin/zones"));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "B2B" | "B2C">("ALL");
  const [form, setForm] = useState({ fromZoneId: "", toZoneId: "", orderType: "B2C" as "B2B" | "B2C", baseWeightKg: "0.5", basePrice: "", perKgRate: "" });
  const [codForm, setCodForm] = useState<Record<string, { percent: string; flatFee: string }>>({});

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await Promise.all([cards.mutate(), cod.mutate()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const allCards = cards.data?.rateCards ?? [];
  const shown = filter === "ALL" ? allCards : allCards.filter((c) => c.orderType === filter);

  return (
    <Shell role="ADMIN" title="LastMile · Ops">
      <header className="page-head"><div><p className="micro">Admin / rate engine</p><h1>Pricing.</h1></div><span className="micro">Zone pair × order type</span></header>

      {err && <div className="mt-4"><ErrorNote error={err} /></div>}

      {/* COD surcharges */}
      <div className="config-grid">
        {["B2B", "B2C"].map((t) => {
          const row = cod.data?.codSurcharges.find((c) => c.orderType === t);
          const cf = codForm[t] ?? { percent: String(row?.percent ?? ""), flatFee: String(row?.flatFee ?? "") };
          return (
            <form
              key={t}
              className="config-panel"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => api(`/admin/cod-surcharges/${t}`, {
                  method: "PUT",
                  body: { percent: Number(cf.percent), flatFee: Number(cf.flatFee), active: true },
                }));
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <Micro>COD surcharge · {t}</Micro>
                <span className={`status ${row?.active ? "status-done" : "status-neutral"}`}>{row?.active ? "Active" : "Unset"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Percent of COD value"><input className="field" type="number" step="0.01" min="0" required value={cf.percent} onChange={(e) => setCodForm({ ...codForm, [t]: { ...cf, percent: e.target.value } })} /></Field>
                <Field label="Flat fee (₹)"><input className="field" type="number" step="0.01" min="0" required value={cf.flatFee} onChange={(e) => setCodForm({ ...codForm, [t]: { ...cf, flatFee: e.target.value } })} /></Field>
              </div>
              <button className="btn btn-outline w-full mt-4" disabled={busy}>Save {t} surcharge</button>
            </form>
          );
        })}
      </div>

      {/* New rate card */}
      <section className="config-panel mt-6">
        <Micro>New / supersede rate card</Micro>
        <h2 className="font-display font-bold text-lg mt-1 mb-4">Add rate card</h2>
        <form
          className="grid sm:grid-cols-7 gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api("/admin/rate-cards", {
              method: "POST",
              body: {
                fromZoneId: form.fromZoneId, toZoneId: form.toZoneId, orderType: form.orderType,
                baseWeightKg: Number(form.baseWeightKg), basePrice: Number(form.basePrice),
                perKgRate: Number(form.perKgRate), active: true,
              },
            }));
          }}
        >
          <Field label="From zone">
            <select className="field" required value={form.fromZoneId} onChange={(e) => setForm({ ...form, fromZoneId: e.target.value })}>
              <option value="">…</option>
              {zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
          <Field label="To zone">
            <select className="field" required value={form.toZoneId} onChange={(e) => setForm({ ...form, toZoneId: e.target.value })}>
              <option value="">…</option>
              {zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="field" value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as "B2B" | "B2C" })}>
              <option value="B2C">B2C</option><option value="B2B">B2B</option>
            </select>
          </Field>
          <Field label="Base incl. (kg)"><input className="field" type="number" step="0.01" min="0.01" required value={form.baseWeightKg} onChange={(e) => setForm({ ...form, baseWeightKg: e.target.value })} /></Field>
          <Field label="Base price ₹"><input className="field" type="number" step="0.01" min="0" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></Field>
          <Field label="Per kg ₹"><input className="field" type="number" step="0.01" min="0" required value={form.perKgRate} onChange={(e) => setForm({ ...form, perKgRate: e.target.value })} /></Field>
          <button className="btn btn-primary" disabled={busy}><Plus size={14} /> Save card</button>
        </form>
        <p className="micro mt-3">Activating a card for a zone pair supersedes its previous active card — history is retained.</p>
      </section>

      {/* Cards table */}
      <section className="table-wrap mt-6">
        <div className="flex items-center justify-between px-5 pt-4">
          <Micro>Rate matrix · {shown.length} cards</Micro>
          <div className="flex gap-1">
            {(["ALL", "B2B", "B2C"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? "btn-outline" : "btn-ghost"}`}>{f}</button>
            ))}
          </div>
        </div>
        {cards.isLoading ? <Spinner /> : (
          <table className="tbl mt-2">
            <thead><tr><th>Lane</th><th>Type</th><th>Base incl.</th><th>Base price</th><th>Per kg</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.fromZoneName} → {c.toZoneName}</td>
                  <td className="font-mono text-xs">{c.orderType}</td>
                  <td className="font-mono tabular-nums">{c.baseWeightKg} kg</td>
                  <td className="font-mono tabular-nums">{fmtMoney(c.basePrice)}</td>
                  <td className="font-mono tabular-nums">{fmtMoney(c.perKgRate)}</td>
                  <td><span className={`status ${c.active ? "status-done" : "status-neutral"}`}>{c.active ? "Active" : "Superseded"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
