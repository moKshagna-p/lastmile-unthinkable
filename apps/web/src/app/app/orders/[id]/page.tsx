"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { CalendarClock, Check, MapPin, Phone, Truck, X } from "lucide-react";
import { Shell } from "@/components/shell";
import { ErrorNote, Field, Micro, Spinner, Stamp, Stepper } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtKg, fmtMoney, fmtTime, STATUS_LABELS } from "@/lib/format";
import type { OrderStatus } from "@lastmile/shared";

interface OrderDetail {
  order: {
    id: string; code: string; status: OrderStatus; totalCharge: number; freightCharge: number;
    codSurcharge: number; volumetricWeightKg: number; billableWeightKg: number; actualWeightKg: number;
    lengthCm: number; breadthCm: number; heightCm: number;
    orderType: "B2B" | "B2C"; paymentType: "PREPAID" | "COD"; codAmount: number | null;
    pickupContactName: string; pickupContactPhone: string; pickupLine1: string;
    dropContactName: string; dropContactPhone: string; dropLine1: string;
    failureReason: string | null; rescheduleFor: string | null;
    createdAt: string;
  };
  events: Array<{ id: string; status: OrderStatus; note: string | null; actorName: string; actorRole: string; createdAt: string }>;
  agent: { id: string; code: string; name: string; phone: string } | null;
  pickupArea: { name: string; pincode: string; zoneId: string } | null;
  dropArea: { name: string; pincode: string } | null;
}

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<OrderDetail>(`order-${id}`, () => api(`/orders/${id}`));
  const [showReschedule, setShowReschedule] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [rsError, setRsError] = useState<string | null>(null);

  async function reschedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRsError(null);
    try {
      await api(`/orders/${id}/reschedule`, {
        method: "POST",
        body: { rescheduleFor: new Date(date).toISOString(), note: note || undefined },
      });
      setShowReschedule(false);
      mutate();
      router.refresh();
    } catch (err) {
      setRsError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Shell role="ANY" title="LastMile"><Spinner label="Loading shipment" /></Shell>;
  if (error || !data)
    return (
      <Shell role="ANY" title="LastMile">
        <ErrorNote error={error ?? "Not found"} />
      </Shell>
    );

  const { order, events, agent, pickupArea, dropArea } = data;

  return (
    <Shell role="ANY" title="LastMile">
      <header className="page-head tracking-head">
        <div>
          <p className="micro">Waybill</p>
          <h1 className="!font-mono">{order.code}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Stamp status={order.status} />
          {order.status === "FAILED" && (
            <button className="btn btn-primary" onClick={() => setShowReschedule(true)}>
              <CalendarClock size={14} /> Reschedule delivery
            </button>
          )}
        </div>
      </header>

      {/* Lifecycle stepper — where is my parcel? */}
      <section className="tracking-progress">
        <Stepper status={order.status} />
        {order.status === "FAILED" && order.rescheduleFor && (
          <p className="micro mt-4 text-center flex items-center justify-center gap-1.5">
            <CalendarClock size={11} /> Retry scheduled for {fmtDate(order.rescheduleFor)}
          </p>
        )}
      </section>

      {/* Route strip */}
      <section className="tracking-route">
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-5 items-center">
          <div>
            <Micro>Pickup · {pickupArea?.pincode}</Micro>
            <p className="font-medium mt-1">{order.pickupContactName}</p>
            <p className="text-sm text-[var(--color-ink-2)]">{order.pickupLine1}, {pickupArea?.name}</p>
            <p className="micro mt-1 flex items-center gap-1"><Phone size={10} /> {order.pickupContactPhone}</p>
          </div>
          <div className="hidden md:flex flex-col items-center px-4">
            <span className="micro !text-[var(--color-signal)]">{order.orderType} · {order.paymentType}{order.codAmount ? ` · ₹${order.codAmount}` : ""}</span>
            <div className="relative w-28 my-2.5">
              <div className={`route-dash w-full ${["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(order.status) ? "route-dash-live" : ""}`} />
              {order.status !== "PLACED" && order.status !== "DELIVERED" && (
                <Truck size={15} className="absolute -top-[8px] left-1/2 -translate-x-1/2 bg-[var(--color-surface)] px-[3px] text-[var(--color-signal-deep)]" />
              )}
              {order.status === "DELIVERED" && (
                <Check size={15} strokeWidth={3} className="absolute -top-[8px] left-1/2 -translate-x-1/2 bg-[var(--color-surface)] px-[3px] text-[var(--color-go)]" />
              )}
            </div>
            <span className="micro">{fmtKg(order.billableWeightKg)} billable</span>
          </div>
          <div className="md:text-right">
            <Micro>Drop · {dropArea?.pincode}</Micro>
            <p className="font-medium mt-1">{order.dropContactName}</p>
            <p className="text-sm text-[var(--color-ink-2)]">{order.dropLine1}, {dropArea?.name}</p>
            <p className="micro mt-1 flex md:justify-end items-center gap-1"><Phone size={10} /> {order.dropContactPhone}</p>
          </div>
        </div>

        {order.status === "FAILED" && (
          <div className="mt-5 border-l-4 border-[var(--color-stop)] bg-[var(--color-stop-wash)] p-4 text-sm">
            <p className="font-semibold text-[var(--color-stop)]">Delivery attempt failed</p>
            <p className="text-[var(--color-ink-2)] mt-0.5">{order.failureReason ?? "No reason recorded."}</p>
            <p className="text-[var(--color-ink-2)] mt-1">Pick a new date — a fresh agent will be assigned automatically for the retry.</p>
          </div>
        )}
        {agent && (
          <div className="mt-5 border-t border-[var(--color-rule)] pt-4 flex items-center justify-between text-sm">
            <div>
              <Micro>Assigned rider</Micro>
              <p className="font-medium">{agent.name} · <span className="font-mono">{agent.code}</span></p>
            </div>
            <a href={`tel:${agent.phone}`} className="btn btn-outline btn-sm"><Phone size={13} /> Call</a>
          </div>
        )}
      </section>

      <div className="tracking-lower">
        {/* Timeline */}
        <section className="tracking-timeline">
          <Micro>Tracking history · immutable</Micro>
          <h2 className="font-display font-bold text-lg mt-1 mb-6">Journey</h2>
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
                  <span className={`tl-dot ${filled ? "tl-dot-done" : ""} ${dotCls}`}>
                    {dotCls === "tl-dot-go" || dotCls === "tl-dot-fail" ? (
                      <Check size={11} strokeWidth={3} className="text-white" />
                    ) : dotCls === "tl-dot-signal" ? (
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal)]" />
                    ) : filled ? (
                      <Check size={11} strokeWidth={3} className="text-white" />
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

        {/* Charges */}
        <section className="tracking-invoice">
          <Micro>Charges · rate engine output</Micro>
          <h2 className="font-display font-bold text-lg mt-1 mb-4">Invoice</h2>
          <dl className="space-y-2.5 font-mono text-sm">
            <Row k="Dimensions" v={`${order.lengthCm}×${order.breadthCm}×${order.heightCm} cm`} />
            <Row k="Actual weight" v={fmtKg(order.actualWeightKg)} />
            <Row k="Volumetric weight" v={fmtKg(order.volumetricWeightKg)} />
            <Row k="Billable weight" v={fmtKg(order.billableWeightKg)} strong />
            <div className="route-dash my-2" />
            <Row k="Freight" v={fmtMoney(order.freightCharge)} />
            <Row k="COD surcharge" v={fmtMoney(order.codSurcharge)} />
          </dl>
          <div className="quote-total mt-4">
            <span className="micro">Total</span>
            <span>{fmtMoney(order.totalCharge)}</span>
          </div>
        </section>
      </div>

      {/* Reschedule modal */}
      {showReschedule && (
        <div className="modal-backdrop" onClick={() => setShowReschedule(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={reschedule} className="modal-panel">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-xl">Reschedule delivery</h2>
              <button type="button" onClick={() => setShowReschedule(false)} className="text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"><X size={18} /></button>
            </div>
            <p className="text-sm text-[var(--color-ink-2)] mb-5">Choose a new date for {order.code}. The system will assign the nearest available rider for the retry.</p>
            <Field label="New delivery date">
              <input type="date" className="field" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="mt-4">
              <Field label="Note for the rider (optional)">
                <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Deliver after 6pm…" maxLength={500} />
              </Field>
            </div>
            {rsError && <div className="mt-4"><ErrorNote error={rsError} /></div>}
            <button className="btn btn-primary w-full mt-5" disabled={busy}>
              {busy ? "Rescheduling…" : "Confirm reschedule"}
            </button>
          </form>
        </div>
      )}
    </Shell>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--color-ink-3)]">{k}</dt>
      <dd className={`${strong ? "font-semibold" : ""} tabular-nums`}>{v}</dd>
    </div>
  );
}
