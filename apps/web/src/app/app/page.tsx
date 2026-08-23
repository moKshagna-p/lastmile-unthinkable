"use client";

import useSWR from "swr";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { EmptyState, Stamp, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { OrderStatus } from "@lastmile/shared";
import { PackageOpen } from "lucide-react";

interface OrderRow {
  id: string; code: string; status: OrderStatus; totalCharge: number;
  dropContactName: string; createdAt: string; orderType: string; paymentType: string;
}

export default function CustomerHome() {
  const { data, error, isLoading } = useSWR<{ orders: OrderRow[] }>(
    "orders", () => api("/orders"),
  );

  const orders = data?.orders ?? [];
  const active = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
  const spend = orders.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.totalCharge, 0);

  return (
    <Shell role="CUSTOMER" title="LastMile">
      <div className="rise">
        <h1 className="font-display font-bold text-3xl tracking-tight">Shipments</h1>
        <p className="micro mt-1">Your parcels across the network</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mt-6 rise rise-1">
        <Stat label="Active" value={active.length} />
        <Stat label="Delivered" value={orders.filter((o) => o.status === "DELIVERED").length} />
        <Stat label="Total orders" value={orders.length} />
        <Stat label="Delivered spend" value={fmtMoney(spend)} />
      </div>

      <div className="flex items-center justify-between mt-10 mb-4 rise rise-2">
        <h2 className="font-display font-bold text-xl tracking-tight">All orders</h2>
        <Link href="/app/new" className="btn btn-primary">+ New order</Link>
      </div>

      <div className="card overflow-x-auto rise rise-3">
        {isLoading ? (
          <Spinner label="Loading shipments" />
        ) : error ? (
          <p className="p-6 text-sm text-[var(--color-stop)]">Could not load orders. Is the API running?</p>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={20} />}
            title="No shipments yet"
            body="Place your first order — pricing is quoted by the rate engine before you confirm."
            action={<Link href="/app/new" className="btn btn-primary">Place an order</Link>}
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Waybill</th><th>Consignee</th><th>Type</th><th>Payment</th><th>Charge</th><th>Status</th><th>Placed</th><th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono font-semibold">{o.code}</td>
                  <td>{o.dropContactName}</td>
                  <td className="font-mono text-xs">{o.orderType}</td>
                  <td className="font-mono text-xs">{o.paymentType}</td>
                  <td className="font-mono tabular-nums">{fmtMoney(o.totalCharge)}</td>
                  <td><Stamp status={o.status} /></td>
                  <td className="text-[var(--color-ink-2)] whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                  <td><Link href={`/app/orders/${o.id}`} className="btn btn-ghost !py-1.5 !px-3">Track</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
