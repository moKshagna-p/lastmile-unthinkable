"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Shell } from "@/components/shell";
import { Micro, Spinner, Stamp, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtMoney, STATUS_LABELS } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@lastmile/shared";

interface AdminOrder {
  id: string; code: string; status: OrderStatus; totalCharge: number;
  customerName: string; dropContactName: string; createdAt: string;
  orderType: string; paymentType: string; assignedAgentId: string | null;
}
interface ZoneRow { id: string; name: string; }
interface AgentRow { id: string; code: string; name: string; }

export default function AdminOverview() {
  const [status, setStatus] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [agentId, setAgentId] = useState("");

  const qs = new URLSearchParams(
    Object.entries({ status, zoneId, agentId }).filter(([, v]) => v),
  ).toString();

  const { data, error, isLoading } = useSWR<{ orders: AdminOrder[] }>(
    `admin-orders-${qs}`, () => api(`/admin/orders${qs ? `?${qs}` : ""}`),
  );
  const { data: stats } = useSWR<{ ordersByStatus: Record<string, number>; revenue: number }>("admin-stats", () => api("/admin/stats"));
  const { data: zones } = useSWR<{ zones: ZoneRow[] }>("zones", () => api("/admin/zones"));
  const { data: agents } = useSWR<{ agents: AgentRow[] }>("agents", () => api("/admin/agents"));

  const orders = data?.orders ?? [];
  const byStatus = stats?.ordersByStatus ?? {};

  return (
    <Shell role="ADMIN" title="LastMile · Ops">
      <div className="rise">
        <h1 className="font-display font-bold text-3xl tracking-tight">Control tower</h1>
        <p className="micro mt-1">Every shipment · every zone · every rider</p>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 rise rise-1">
        <Stat label="Placed" value={byStatus.PLACED ?? 0} />
        <Stat label="In network" value={(byStatus.ASSIGNED ?? 0) + (byStatus.PICKED_UP ?? 0) + (byStatus.IN_TRANSIT ?? 0) + (byStatus.OUT_FOR_DELIVERY ?? 0)} />
        <Stat label="Delivered" value={byStatus.DELIVERED ?? 0} />
        <Stat label="Failed" value={byStatus.FAILED ?? 0} />
        <Stat label="Rescheduled" value={byStatus.RESCHEDULED ?? 0} />
        <Stat label="Booked revenue" value={fmtMoney(stats?.revenue ?? 0)} />
      </div>

      {/* Filters */}
      <div className="card p-4 mt-8 grid sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-3 items-end rise rise-2">
        <div>
          <Micro>Status</Micro>
          <select className="field mt-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <Micro>Zone</Micro>
          <select className="field mt-1.5" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">All zones</option>
            {zones?.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div>
          <Micro>Agent</Micro>
          <select className="field mt-1.5" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">All agents</option>
            {agents?.agents.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        {(status || zoneId || agentId) && (
          <button className="btn btn-ghost" onClick={() => { setStatus(""); setZoneId(""); setAgentId(""); }}>Clear</button>
        )}
      </div>

      <div className="card overflow-x-auto mt-4 rise rise-3">
        {isLoading ? (
          <Spinner label="Loading orders" />
        ) : error ? (
          <p className="p-6 text-sm text-[var(--color-stop)]">Could not load orders.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Waybill</th><th>Customer</th><th>Consignee</th><th>Type</th><th>Charge</th><th>Status</th><th>Placed</th><th /></tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--color-ink-3)]">No orders match these filters.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono font-semibold">{o.code}</td>
                  <td>{o.customerName}</td>
                  <td>{o.dropContactName}</td>
                  <td className="font-mono text-xs">{o.orderType} · {o.paymentType}</td>
                  <td className="font-mono tabular-nums">{fmtMoney(o.totalCharge)}</td>
                  <td><Stamp status={o.status} /></td>
                  <td className="whitespace-nowrap text-[var(--color-ink-2)]">{fmtDate(o.createdAt)}</td>
                  <td><Link href={`/admin/orders/${o.id}`} className="btn btn-ghost !py-1.5 !px-3">Manage</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
