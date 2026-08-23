"use client";

import { useState } from "react";
import useSWR from "swr";
import AddressAutocomplete from "@/components/address-autocomplete";
import { Plus, Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { PlaceSelection } from "@/lib/geocode";

interface Zone { id: string; name: string; code: string; description: string | null; areaCount: number }
interface Area { id: string; name: string; pincode: string; city: string; zoneId: string; zoneName: string; lat: number; lng: number }

export default function NetworkAdmin() {
  const zones = useSWR<{ zones: Zone[] }>("zones", () => api("/admin/zones"));
  const areas = useSWR<{ areas: Area[] }>("areas", () => api("/admin/areas"));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [zoneForm, setZoneForm] = useState({ name: "", code: "", description: "" });
  const [areaForm, setAreaForm] = useState({ name: "", pincode: "", city: "Bengaluru", zoneId: "", lat: "", lng: "" });
  const [areaSearch, setAreaSearch] = useState("");

  /** Google— er, Photon pick → prefill the mapping form (still editable). */
  function autofillFromPlace(sel: PlaceSelection) {
    setAreaForm((f) => ({
      ...f,
      name: f.name || sel.line1,
      pincode: sel.pincode ?? f.pincode,
      city: sel.city ?? f.city,
      lat: String(sel.lat),
      lng: String(sel.lng),
    }));
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await Promise.all([zones.mutate(), areas.mutate()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="ADMIN" title="LastMile · Ops">
      <div className="rise">
        <h1 className="font-display font-bold text-3xl tracking-tight">Network</h1>
        <p className="micro mt-1">Zones and the pincode → zone mapping that drives rate detection</p>
      </div>

      {err && <div className="mt-4"><ErrorNote error={err} /></div>}

      <div className="grid lg:grid-cols-2 gap-6 mt-6 items-start">
        {/* Zones */}
        <section className="card p-6 rise rise-1">
          <Micro>Service zones</Micro>
          <h2 className="font-display font-bold text-lg mt-1 mb-4">Zones</h2>
          <div className="space-y-2">
            {zones.isLoading ? <Spinner /> : zones.data?.zones.map((z) => (
              <div key={z.id} className="flex items-center justify-between border border-[var(--color-line)] rounded px-4 py-3 bg-[#fffdf8]">
                <div>
                  <p className="font-medium">{z.name} <span className="font-mono text-xs text-[var(--color-ink-3)]">/{z.code}</span></p>
                  <Micro className="mt-0.5">{z.areaCount} pincode area{z.areaCount === 1 ? "" : "s"}{z.description ? ` · ${z.description}` : ""}</Micro>
                </div>
                <button
                  disabled={busy}
                  onClick={() => confirm(`Delete zone ${z.name}?`) && act(() => api(`/admin/zones/${z.id}`, { method: "DELETE" }))}
                  className="text-[var(--color-ink-3)] hover:text-[var(--color-stop)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-5 border-t border-dashed border-[var(--color-line-2)] pt-5 grid grid-cols-[1fr_90px_auto] gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api("/admin/zones", { method: "POST", body: zoneForm })).then(() => setZoneForm({ name: "", code: "", description: "" }));
            }}
          >
            <Field label="Zone name"><input className="field" required value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="West Bengaluru" /></Field>
            <Field label="Code"><input className="field" required maxLength={12} value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value.toUpperCase() })} placeholder="WES" /></Field>
            <button className="btn btn-primary" disabled={busy}><Plus size={14} /> Add</button>
          </form>
        </section>

        {/* Areas */}
        <section className="card p-6 rise rise-2">
          <Micro>Pincode mapping · one pincode = one zone</Micro>
          <h2 className="font-display font-bold text-lg mt-1 mb-4">Areas</h2>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {areas.isLoading ? <Spinner /> : areas.data?.areas.map((a) => (
              <div key={a.id} className="flex items-center justify-between border border-[var(--color-line)] rounded px-4 py-2.5 bg-[#fffdf8] text-sm">
                <div>
                  <span className="font-mono font-semibold">{a.pincode}</span> · {a.name}
                  <span className="micro ml-2">{a.zoneName}</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => confirm(`Unmap ${a.pincode}?`) && act(() => api(`/admin/areas/${a.id}`, { method: "DELETE" }))}
                  className="text-[var(--color-ink-3)] hover:text-[var(--color-stop)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-5 border-t border-dashed border-[var(--color-line-2)] pt-5 grid grid-cols-2 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => api("/admin/areas", {
                method: "POST",
                body: { ...areaForm, lat: Number(areaForm.lat), lng: Number(areaForm.lng) },
              })).then(() => {
                setAreaForm({ name: "", pincode: "", city: "Bengaluru", zoneId: "", lat: "", lng: "" });
                setAreaSearch("");
              });
            }}
          >
            <div className="col-span-2">
              <AddressAutocomplete
                id="area-search"
                label="Search location"
                value={areaSearch}
                onValueChange={setAreaSearch}
                onSelect={autofillFromPlace}
                placeholder='e.g. "Rajajinagar, Bengaluru" — autofills the form below'
                note="Free OpenStreetMap lookup · no API key needed"
              />
            </div>
            <Field label="Area name"><input className="field" required value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} placeholder="Rajajinagar" /></Field>
            <Field label="Pincode"><input className="field" required pattern="\d{6}" value={areaForm.pincode} onChange={(e) => setAreaForm({ ...areaForm, pincode: e.target.value })} placeholder="560010" /></Field>
            <Field label="Zone">
              <select className="field" required value={areaForm.zoneId} onChange={(e) => setAreaForm({ ...areaForm, zoneId: e.target.value })}>
                <option value="">Select…</option>
                {zones.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lat"><input className="field" required type="number" step="any" value={areaForm.lat} onChange={(e) => setAreaForm({ ...areaForm, lat: e.target.value })} placeholder="12.99" /></Field>
              <Field label="Lng"><input className="field" required type="number" step="any" value={areaForm.lng} onChange={(e) => setAreaForm({ ...areaForm, lng: e.target.value })} placeholder="77.55" /></Field>
            </div>
            <button className="btn btn-primary col-span-2" disabled={busy}><Plus size={14} /> Map pincode to zone</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
