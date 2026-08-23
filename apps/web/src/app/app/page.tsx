"use client";

import useSWR from "swr";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { EmptyState, Stamp, Spinner } from "@/components/ui";
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
  const latest = orders[0];

  return (
    <Shell role="CUSTOMER" title="LastMile">
      <header className="page-head">
        <div>
          <p className="micro">Customer network / {active.length} active</p>
          <h1>Your shipments.</h1>
        </div>
        <Link href="/app/new" className="btn btn-primary">New order +</Link>
      </header>

      {latest && (
        <section className="customer-latest">
          <div>
            <p className="micro">Latest shipment</p>
            <h2>{latest.code}</h2>
            <p>For {latest.dropContactName} · placed {fmtDate(latest.createdAt)}</p>
          </div>
          <div className="customer-latest-status">
            <Stamp status={latest.status} />
            <strong>{fmtMoney(latest.totalCharge)}</strong>
            <Link href={`/app/orders/${latest.id}`} className="btn btn-outline">Track shipment</Link>
          </div>
        </section>
      )}

      <div className="section-head">
        <div><p className="micro">History</p><h2>All orders</h2></div>
        <span className="micro">{orders.length} total</span>
      </div>

      <div className="table-wrap">
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
                  <td><Link href={`/app/orders/${o.id}`} className="btn btn-ghost btn-sm">Track</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
