"use client";

import { STATUS_LABELS, type OrderStatus } from "@lastmile/shared";
import { statusStamp } from "@/lib/format";

export function Stamp({ status }: { status: OrderStatus }) {
  return <span className={statusStamp(status)}>{STATUS_LABELS[status]}</span>;
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
    <div className="card px-5 py-4">
      <Micro>{label}</Micro>
      <div className="font-mono text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}
