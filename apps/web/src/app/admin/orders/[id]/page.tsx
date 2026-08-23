"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, Radar, UserRound } from "lucide-react";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro, Spinner, Stamp, Stepper } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtKg, fmtMoney, fmtTime, STATUS_LABELS } from "@/lib/format";
import { canTransition, ORDER_STATUSES, type OrderStatus } from "@lastmile/shared";

interface Detail {
  order: {
    id: string; code: string; status: OrderStatus; totalCharge: number; freightCharge: number;
    codSurcharge: number; volumetricWeightKg: number; billableWeightKg: number;
    dropContactName: string; dropLine1: string; failureReason: string | null;
    assignedAgentId: string | null; createdAt: string; orderType: string; paymentType: string;
  };
  events: Array<{ id: string; status: OrderStatus; note: string | null; actorName: string; actorRole: string; createdAt: string }>;
  agent: { id: string; code: string; name: string } | null;
}

export default function AdminOrder() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Detail>(`admin-order-${id}`, () => api(`/orders/${id}`));
  const { data: agentData } = useSWR("agents", () => api<{ agents: Array<{ id: string; code: string; name: string; status: string; activeLoad: number; capacity: number }> }>("/admin/agents"));

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideTo, setOverrideTo] = useState("");
  const [note, setNote] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Shell role="ADMIN" title="LastMile · Ops"><Spinner /></Shell>;
  if (!data) return <Shell role="ADMIN" title="LastMile · Ops"><ErrorNote error={error ?? "Not found"} /></Shell>;

  const { order, events, agent } = data;
  const overrides = ORDER_STATUSES.filter((s) => s !== order.status);

  return (
    <Shell role="ADMIN" title="LastMile · Ops">
      <div className="flex flex-wrap items-start justify-between gap-4 rise">
        <div>
          <p className="micro">Waybill</p>
          <h1 className="font-display font-bold text-3xl tracking-tight font-mono">{order.code}</h1>
          <p className="micro mt-1">{order.orderType} · {order.paymentType} · placed {fmtDate(order.createdAt)}</p>
        </div>
        <Stamp status={order.status} />
      </div>

      <section className="card p-6 mt-6 rise rise-1">
        <Stepper status={order.status} />
      </section>

      {err && <div className="mt-4"><ErrorNote error={err} /></div>}

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6 mt-6 items-start">
        {/* Dispatch panel */}
        <section className="card p-6 rise rise-1 space-y-6">
          <div>
            <Micro>Dispatch</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-3">Agent assignment</h2>
            {agent ? (
              <div className="border border-[var(--color-line)] bg-[var(--color-paper-2)] rounded p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{agent.name} · <span className="font-mono">{agent.code}</span></p>
                  <Micro className="mt-0.5">Currently assigned</Micro>
                </div>
                <UserRound size={20} className="text-[var(--color-ink-3)]" />
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-3)]">No agent on this order yet.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button disabled={busy} onClick={() => run(() => api(`/admin/orders/${id}/assign`, { method: "POST", body: { auto: true } }))} className="btn btn-primary">
                <Radar size={14} /> Auto-assign nearest
              </button>
            </div>
            <div className="mt-4">
              <Field label="Or pin a specific rider">
                <select
                  className="field"
                  value=""
                  disabled={busy}
                  onChange={(e) => e.target.value && run(() => api(`/admin/orders/${id}/assign`, { method: "POST", body: { agentId: e.target.value, auto: false } }))}
                >
                  <option value="">Select agent…</option>
                  {agentData?.agents.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.status === "OFFLINE"}>
                      {a.code} — {a.name} ({a.activeLoad}/{a.capacity}{a.status === "OFFLINE" ? " · offline" : ""})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="border-t border-dashed border-[var(--color-line-2)] pt-5">
            <Micro>Override</Micro>
            <h2 className="font-display font-bold text-lg mt-1 mb-3">Force status</h2>
            <div className="grid grid-cols-2 gap-3">
              <select className="field" value={overrideTo} onChange={(e) => setOverrideTo(e.target.value)}>
                <option value="">Target status…</option>
                {overrides.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}{canTransition(order.status, s) ? "" : " (breaks lifecycle)"}
                  </option>
                ))}
              </select>
              <input className="field" placeholder="Reason / note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button
              disabled={busy || !overrideTo}
              onClick={() => run(() => api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status: overrideTo, note: note || "Admin override" } }))}
              className="btn btn-outline w-full mt-3"
            >
              Apply override
            </button>
            <p className="micro mt-2 leading-relaxed">Overrides are legal but logged as such in the tracking ledger.</p>
          </div>

          <div className="border-t border-dashed border-[var(--color-line-2)] pt-5 text-sm space-y-1.5">
            <Row k="Consignee" v={`${order.dropContactName} — ${order.dropLine1}`} />
            <Row k="Billable weight" v={fmtKg(order.billableWeightKg)} />
            <Row k="Freight + COD" v={`${fmtMoney(order.freightCharge)} + ${fmtMoney(order.codSurcharge)}`} />
            <Row k="Total" v={fmtMoney(order.totalCharge)} strong />
          </div>
        </section>

        {/* Ledger */}
        <section className="card p-6 rise rise-2">
          <Micro>Tracking ledger · append-only</Micro>
          <h2 className="font-display font-bold text-lg mt-1 mb-6">History</h2>
          <ol>
            {[...events].reverse().map((ev, i) => {
              const latest = i === 0;
              const dotCls =
                ev.status === "FAILED" ? "tl-dot-fail"
                : latest && ev.status === "DELIVERED" ? "tl-dot-go"
                : latest ? "tl-dot-signal"
                : "";
              const filled = ["tl-dot-done", "tl-dot-go", "tl-dot-fail"].includes(dotCls);
              return (
                <li key={ev.id} className="tl-item">
                  <span className={`tl-dot ${filled && dotCls !== "tl-dot-signal" ? "tl-dot-done" : ""} ${dotCls}`}>
                    {dotCls === "tl-dot-go" || dotCls === "tl-dot-fail" || filled ? (
                      <Check size={11} strokeWidth={3} className="text-white" />
                    ) : dotCls === "tl-dot-signal" ? (
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)]" />
                    ) : null}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-semibold text-sm">{STATUS_LABELS[ev.status]}</span>
                    <span className="micro">{fmtDate(ev.createdAt)} · {fmtTime(ev.createdAt)}</span>
                  </div>
                  {ev.note && <p className="text-sm text-[var(--color-ink-2)] mt-0.5">{ev.note}</p>}
                  <p className="micro mt-1">by {ev.actorName} ({ev.actorRole.toLowerCase()})</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <button onClick={() => router.push("/admin")} className="btn btn-ghost mt-8">← Back to control tower</button>
    </Shell>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--color-ink-3)]">{k}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} text-right`}>{v}</span>
    </div>
  );
}
