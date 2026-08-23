import { STATUS_LABELS, type OrderStatus } from "@lastmile/shared";

export function fmtMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtKg(n: number): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Visual state class per order status. */
export function statusStamp(s: OrderStatus): string {
  switch (s) {
    case "DELIVERED": return "status-done";
    case "FAILED": case "CANCELLED": return "status-failed";
    case "PLACED": case "RESCHEDULED": return "status-hold";
    default: return "status-live"; // ASSIGNED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY
  }
}

export { STATUS_LABELS };
