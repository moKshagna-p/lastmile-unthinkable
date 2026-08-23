"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, LoadBar, Micro, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";

interface AgentRow {
  id: string; code: string; name: string; email: string; phone: string;
  vehicle: string | null; status: "AVAILABLE" | "OFFLINE"; capacity: number;
  activeLoad: number; zoneName: string | null; currentLat: number; currentLng: number;
}
interface Zone { id: string; name: string }

export default function AgentsAdmin() {
  const agents = useSWR<{ agents: AgentRow[] }>("agents", () => api("/admin/agents"));
  const zones = useSWR<{ zones: Zone[] }>("zones", () => api("/admin/zones"));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "", vehicle: "", capacity: "3", homeZoneId: "", currentLat: "12.9719", currentLng: "77.5937",
    account: { name: "", email: "", phone: "", password: "" },
  });

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await agents.mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const rows = agents.data?.agents ?? [];

  return (
    <Shell role="ADMIN" title="LastMile · Ops">
      <header className="page-head"><div><p className="micro">Admin / field network</p><h1>Fleet.</h1></div><span className="micro">Availability / capacity / position</span></header>

      <div className="grid sm:grid-cols-3 gap-px mt-6 bg-[var(--color-rule)]">
        <Stat label="Riders" value={rows.length} />
        <Stat label="On duty" value={rows.filter((a) => a.status === "AVAILABLE").length} />
        <Stat label="Parcels in field" value={rows.reduce((s, a) => s + a.activeLoad, 0)} />
      </div>

      {err && <div className="mt-4"><ErrorNote error={err} /></div>}

      {/* Add agent */}
      <section className="config-panel mt-6">
        <Micro>Onboard rider</Micro>
        <h2 className="font-display font-bold text-lg mt-1 mb-4">New agent account</h2>
        <form
          className="grid sm:grid-cols-4 gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api("/admin/agents", {
              method: "POST",
              body: {
                code: form.code, vehicle: form.vehicle || undefined,
                capacity: Number(form.capacity), zoneId: form.homeZoneId || null,
                currentLat: Number(form.currentLat), currentLng: Number(form.currentLng),
                account: form.account,
              },
            }));
          }}
        >
          <Field label="Name"><input className="field" required value={form.account.name} onChange={(e) => setForm({ ...form, account: { ...form.account, name: e.target.value } })} /></Field>
          <Field label="Email"><input className="field" type="email" required value={form.account.email} onChange={(e) => setForm({ ...form, account: { ...form.account, email: e.target.value } })} /></Field>
          <Field label="Phone"><input className="field" required value={form.account.phone} onChange={(e) => setForm({ ...form, account: { ...form.account, phone: e.target.value } })} /></Field>
          <Field label="Temp password"><input className="field" required minLength={8} value={form.account.password} onChange={(e) => setForm({ ...form, account: { ...form.account, password: e.target.value } })} /></Field>
          <Field label="Agent code"><input className="field" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="AG-105" /></Field>
          <Field label="Vehicle"><input className="field" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="Activa · KA-01" /></Field>
          <Field label="Home zone">
            <select className="field" value={form.homeZoneId} onChange={(e) => setForm({ ...form, homeZoneId: e.target.value })}>
              <option value="">None</option>
              {zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cap"><input className="field" type="number" min="1" max="50" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            <Field label="Lat"><input className="field" type="number" step="any" required value={form.currentLat} onChange={(e) => setForm({ ...form, currentLat: e.target.value })} /></Field>
            <Field label="Lng"><input className="field" type="number" step="any" required value={form.currentLng} onChange={(e) => setForm({ ...form, currentLng: e.target.value })} /></Field>
          </div>
          <button className="btn btn-primary sm:col-span-4" disabled={busy}><Plus size={14} /> Onboard agent</button>
        </form>
      </section>

      {/* Fleet table */}
      <section className="table-wrap mt-6">
        {agents.isLoading ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Code</th><th>Rider</th><th>Zone</th><th>Position</th><th>Load</th><th>Status</th><th>Duty</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono font-semibold">{a.code}</td>
                  <td>
                    {a.name}
                    <div className="micro mt-0.5">{a.email}</div>
                  </td>
                  <td>{a.zoneName ?? "—"}</td>
                  <td className="font-mono text-xs tabular-nums">{a.currentLat.toFixed(3)}, {a.currentLng.toFixed(3)}</td>
                  <td className="font-mono tabular-nums">
                    <div className="flex items-center gap-2">
                      <span>{a.activeLoad}/{a.capacity}</span>
                      <div className="w-16"><LoadBar used={a.activeLoad} capacity={a.capacity} /></div>
                    </div>
                  </td>
                  <td><span className={`stamp ${a.activeLoad >= a.capacity ? "stamp-hold" : a.status === "AVAILABLE" ? "stamp-go" : "stamp-stop"}`}>
                    {a.activeLoad >= a.capacity ? "At capacity" : a.status === "AVAILABLE" ? "Available" : "Offline"}
                  </span></td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => act(() => api(`/admin/agents/${a.id}`, { method: "PATCH", body: { status: a.status === "AVAILABLE" ? "OFFLINE" : "AVAILABLE" } }))}
                      className="btn btn-ghost btn-sm"
                    >
                      {a.status === "AVAILABLE" ? "Set offline" : "Set available"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
