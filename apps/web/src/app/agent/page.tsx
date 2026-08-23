"use client";

import { useState } from "react";
import useSWR from "swr";
import { Shell } from "@/components/shell";
import { EmptyState, ErrorNote, Micro, Spinner, Stamp, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import type { OrderStatus } from "@lastmile/shared";
import { MapPin, PackageSearch, PackageCheck, Truck, XCircle } from "lucide-react";

interface AgentOrder {
  id: string; code: string; status: OrderStatus;
  dropContactName: string; dropContactPhone: string; dropLine1: string;
  paymentType: "PREPAID" | "COD"; codAmount: number | null; totalCharge: number;
  customerName: string; customerPhone: string;
}

/**
 * Real GPS fix via the browser (secure contexts only — localhost counts).
 * Resolves null when geolocation is unavailable or denied so scans still go
 * through without coordinates; the server treats lat/lng as an optional ping.
 */
function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

const NEXT_ACTIONS: Record<string, Array<{ to: OrderStatus; label: string; kind: "go" | "mid" | "fail" }>> = {
  ASSIGNED: [{ to: "PICKED_UP", label: "Pick up parcel", kind: "go" }],
  PICKED_UP: [{ to: "IN_TRANSIT", label: "Start transit", kind: "mid" }],
  IN_TRANSIT: [{ to: "OUT_FOR_DELIVERY", label: "Out for delivery", kind: "mid" }],
  OUT_FOR_DELIVERY: [
    { to: "DELIVERED", label: "Delivered", kind: "go" },
    { to: "FAILED", label: "Report failure", kind: "fail" },
  ],
};

export default function AgentConsole() {
  const { data: me } = useSWR("agent-me", () => api<{ agent: { code: string; status: string; capacity: number }; name: string }>("/agent/me"));
  const { data, error, isLoading, mutate } = useSWR<{ orders: AgentOrder[] }>("agent-orders", () => api("/agent/orders"));
  const [failFor, setFailFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);

  async function scan(orderId: string, status: OrderStatus, note?: string) {
    setBusy(true);
    setErr(null);
    try {
      // Real position per scan — feeds agents.currentLat/Lng, which the
      // dispatcher's findNearestAgent() matches against. Omitted when the
      // browser can't provide a fix.
      const pos = await getPosition();
      await api(`/agent/orders/${orderId}/status`, {
        method: "POST",
        body: { status, note, ...(pos ?? {}) },
      });
      setFailFor(null);
      setReason("");
      mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDuty() {
    if (!me || dutyBusy) return;
    const next = me.agent.status === "AVAILABLE" ? "OFFLINE" : "AVAILABLE";
    setDutyBusy(true);
    setErr(null);
    try {
      await api("/agent/status", { method: "PATCH", body: { status: next } });
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change duty status");
    } finally {
      setDutyBusy(false);
    }
  }

  const orders = data?.orders ?? [];

  return (
    <Shell role="AGENT" title="LastMile · Rider">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">Run sheet</h1>
          <p className="micro mt-1">{me ? `${me.name} · ${me.agent.code}` : "…"}</p>
        </div>
        <button onClick={toggleDuty} disabled={!me || dutyBusy} className={`btn ${me?.agent.status === "AVAILABLE" ? "btn-outline" : "btn-primary"}`}>
          {dutyBusy ? "Switching…" : me?.agent.status === "AVAILABLE" ? "Go offline" : "Go on duty"}
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-6 rise rise-1">
        <Stat label="Active runs" value={orders.length} />
        <Stat label="COD to collect" value={fmtMoney(orders.reduce((s, o) => s + (o.paymentType === "COD" && !["DELIVERED"].includes(o.status) ? (o.codAmount ?? 0) : 0), 0))} />
        <Stat label="Capacity used" value={me ? `${orders.length}/${me.agent.capacity}` : "—"} />
      </div>

      {err && <div className="mt-4"><ErrorNote error={err} /></div>}

      <div className="space-y-4 mt-8">
        {isLoading ? (
          <Spinner label="Loading runs" />
        ) : orders.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<PackageSearch size={20} />}
              title="No active runs"
              body="New assignments appear here the moment dispatch tags you."
            />
          </div>
        ) : (
          orders.map((o) => {
            const actions = NEXT_ACTIONS[o.status] ?? [];
            return (
              <article key={o.id} className="card p-5 rise">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-semibold">{o.code}</p>
                    <Micro className="mt-0.5">{o.customerName}</Micro>
                  </div>
                  <Stamp status={o.status} />
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-4 mt-4 items-end">
                  <div className="text-sm">
                    <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-signal)]" />{o.dropLine1} — {o.dropContactName} · {o.dropContactPhone}</p>
                    {o.paymentType === "COD" && (
                      <p className="micro mt-2 !text-[var(--color-signal)]">Collect COD ₹{(o.codAmount ?? 0).toLocaleString("en-IN")} at the door</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {actions.filter((a) => a.kind !== "fail").map((a) => (
                      <button key={a.to} disabled={busy} onClick={() => scan(o.id, a.to)} className={`btn ${a.kind === "go" ? "btn-primary" : "btn-outline"}`}>
                        {a.kind === "go" ? <PackageCheck size={14} /> : <Truck size={14} />} {a.label}
                      </button>
                    ))}
                    {actions.some((a) => a.kind === "fail") && (
                      <button disabled={busy} onClick={() => setFailFor(o.id)} className="btn btn-ghost !text-[var(--color-stop)] !border-[var(--color-stop)]">
                        <XCircle size={14} /> Failed
                      </button>
                    )}
                  </div>
                </div>

                {failFor === o.id && (
                  <form
                    className="mt-4 border-t border-dashed border-[var(--color-line-2)] pt-4 flex flex-wrap gap-3 items-end"
                    onSubmit={(e) => { e.preventDefault(); if (reason.trim()) scan(o.id, "FAILED", reason.trim()); }}
                  >
                    <div className="flex-1 min-w-56">
                      <Micro>Failure reason (required)</Micro>
                      <input className="field mt-1.5" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer unavailable / address unreachable…" />
                    </div>
                    <button type="submit" disabled={busy || !reason.trim()} className="btn btn-primary">Submit failure</button>
                    <button type="button" onClick={() => setFailFor(null)} className="btn btn-ghost">Cancel</button>
                  </form>
                )}
              </article>
            );
          })
        )}
      </div>
    </Shell>
  );
}
