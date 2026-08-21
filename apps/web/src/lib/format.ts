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

/** Tailwind stamp class per status. */
export function statusStamp(s: OrderStatus): string {
  switch (s) {
    case "DELIVERED": return "stamp-go";
    case "FAILED": case "CANCELLED": return "stamp-stop";
    case "PLACED": case "RESCHEDULED": return "stamp-hold";
    default: return "stamp-signal"; // ASSIGNED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY
  }
}

export { STATUS_LABELS };
