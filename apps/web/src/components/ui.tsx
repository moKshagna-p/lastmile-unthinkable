"use client";

import { STATUS_LABELS, type OrderStatus } from "@lastmile/shared";
import { statusStamp } from "@/lib/format";

/** Statuses where the parcel is physically moving through the network. */
const LIVE_STATUSES: ReadonlySet<string> = new Set(["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);

export function Stamp({ status }: { status: OrderStatus }) {
  const live = LIVE_STATUSES.has(status);
  return (
    <span className={`${statusStamp(status)} ${live ? "stamp-live" : ""}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Micro({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`micro ${className}`}>{children}</div>;
}

export function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="border border-[var(--color-stop)] bg-[var(--color-stop-wash)] text-[var(--color-stop)] rounded px-3 py-2 text-[13px]">
      {msg}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-[var(--color-ink-3)]">
      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <span className="micro">{label}…</span>
    </div>
  );
}

export function Stat({
  label, value, sub,
}: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card px-5 py-4 relative overflow-hidden">
      {/* signal tick — a small drafting mark anchoring each figure */}
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-[var(--color-signal)] opacity-70" />
      <Micro>{label}</Micro>
      <div className="font-mono text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}

/** Shared empty state: dashed drop-zone motif with icon + copy + action. */
export function EmptyState({
  icon, title, body, action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="m-4 rounded border-2 border-dashed border-[var(--color-line-2)] px-6 py-12 text-center">
      <span className="inline-grid place-items-center w-11 h-11 rounded-full border border-[var(--color-line-2)] bg-[var(--color-paper-2)] text-[var(--color-ink-3)]">
        {icon}
      </span>
      <p className="font-display font-bold text-lg mt-4">{title}</p>
      <p className="text-sm text-[var(--color-ink-2)] mt-1 max-w-sm mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Decorative barcode — deterministic bar pattern derived from the input
 * string, so the same waybill always renders the same artifact.
 */
export function Barcode({ value, className = "" }: { value: string; className?: string }) {
  const bars = [...value].map((ch) => ch.charCodeAt(0));
  let x = 0;
  const rects = bars.flatMap((code) => {
    const w = (code % 3) + 1; // 1–3 units wide
    const gap = ((code >> 2) % 3) + 1.5;
    const rect = { x, w };
    x += w + gap;
    return [rect];
  });
  return (
    <svg
      viewBox={`0 0 ${Math.max(x, 1)} 24`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={24} fill="currentColor" />
      ))}
    </svg>
  );
}

/* ── Progress stepper: the lifecycle as a horizontal journey ─────────────── */

const LIFECYCLE: OrderStatus[] = ["PLACED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

/** Maps any status onto its position in the happy-path stepper. */
function stepIndex(s: OrderStatus): number {
  if (s === "RESCHEDULED") return 1; // waiting on reassignment
  const i = LIFECYCLE.indexOf(s);
  return i === -1 ? 0 : i;
}

export function Stepper({ status }: { status: OrderStatus }) {
  // FAILED/CANCELLED render a dedicated state instead of the journey.
  if (status === "FAILED" || status === "CANCELLED") {
    return (
      <div className={`stamp ${statusStamp(status)} w-fit`} role="status">
        {STATUS_LABELS[status]} — no further movement
      </div>
    );
  }

  const cur = stepIndex(status);
  const pct = (cur / (LIFECYCLE.length - 1)) * 100;

  return (
    <div className="stepper" role="list" aria-label="Delivery progress">
      <span aria-hidden className="stepper-rail" />
      <span aria-hidden className="stepper-fill" style={{ width: `${pct}%` }} />
      {LIFECYCLE.map((s, i) => (
        <div key={s} className={`step ${i < cur ? "step-done" : ""} ${i === cur ? "step-current" : ""}`} role="listitem" aria-current={i === cur ? "step" : undefined}>
          <span className="step-dot">{i < cur ? "✓" : i + 1}</span>
          <span className={`step-label ${i === cur || i === LIFECYCLE.length - 1 ? "" : "hidden sm:inline"}`}>
            {STATUS_LABELS[s]}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Capacity bar — green under load, amber near full, red at capacity. */
export function LoadBar({ used, capacity }: { used: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  const cls = pct >= 100 ? "loadbar-full" : pct >= 75 ? "loadbar-warn" : "";
  return (
    <div className={`loadbar ${cls}`} role="img" aria-label={`${used} of ${capacity} capacity used`}>
      <span style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}

/** Accessible duty switch for agent availability. */
export function DutyToggle({
  on, disabled, onClick,
}: { on: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "On duty — tap to go offline" : "Offline — tap to go on duty"}
      className={`toggle ${on ? "toggle-on" : ""}`}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
