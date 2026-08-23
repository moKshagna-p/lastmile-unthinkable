"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceSelection, type Suggestion } from "@/lib/geocode";

/**
 * Address type-ahead powered by Photon (free OpenStreetMap geocoder — no API
 * key). Debounced requests with abort of stale in-flight ones, keyboard
 * navigable. Because Photon results already include pincode + coordinates,
 * selection is instant: no second details round-trip.
 */

export default function AddressAutocomplete({
  id,
  label,
  value,
  onValueChange,
  onSelect,
  placeholder = "Start typing an address…",
  required,
  note,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  onSelect: (sel: PlaceSelection) => void;
  placeholder?: string;
  required?: boolean;
  note?: string;
}) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const search = useCallback(async (input: string) => {
    setErr(null);
    setLoading(true);
    try {
      const found = await searchPlaces(input);
      setRows(found);
      setOpen(true);
      setActive(-1);
      if (found.length === 0) setErr("No matches — try a nearby street or area name");
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // superseded by newer keystrokes
      setRows([]);
      setErr(e instanceof Error ? e.message : "Address lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(v: string) {
    onValueChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 3) {
      setRows([]);
      setOpen(false);
      setErr(null);
      return;
    }
    debounceRef.current = setTimeout(() => void search(v.trim()), 300); // stay polite to the free instance
  }

  function choose(row: Suggestion) {
    setOpen(false);
    setRows([]);
    setErr(null);
    onValueChange(row.selection.line1);
    onSelect(row.selection);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || rows.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % rows.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + rows.length) % rows.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(rows[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="micro block mb-1.5">
        {label}
        {required && <span aria-hidden className="text-[var(--color-signal)]"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          className={`field pr-8 ${err ? "!border-[var(--color-signal)]" : ""}`}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => rows.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-[var(--color-ink-3)]/40 border-t-[var(--color-ink)] rounded-full animate-spin" />
        )}
      </div>

      {note && !err && <p className="mt-1 text-[11px] text-[var(--color-ink-3)]">{note}</p>}
      {err && <p className="mt-1 text-[11px] text-[var(--color-signal-deep)]">{err}</p>}

      {open && rows.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-[3px] border border-[var(--color-line-2)] bg-[#fffdf8] shadow-lg shadow-black/10"
        >
          {rows.map((row, i) => (
            <li key={row.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
                className={`w-full text-left px-3.5 py-2.5 border-b border-dashed border-[var(--color-line)] last:border-b-0 transition-colors ${
                  i === active ? "bg-[var(--color-paper-2)]" : ""
                }`}
              >
                <span className="block text-sm font-medium truncate">{row.main}</span>
                {row.secondary && (
                  <span className="block text-xs text-[var(--color-ink-3)] truncate mt-0.5">{row.secondary}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
