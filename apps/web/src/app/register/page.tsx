"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ErrorNote, Field } from "@/components/ui";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // `phone` is a required additional field server-side; the generic client
    // types don't know it, so it rides along as an extra body property.
    try {
      const { error } = await authClient.signUp.email({
        name: form.name,
        email: form.email,
        password: form.password,
        ...({ phone: form.phone } as object),
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (error) {
        setError(error.message ?? "Registration failed");
        setBusy(false);
        return;
      }
    } catch {
      // Network-level failure (API down/unreachable): better-auth rejects
      // instead of resolving { error }; catch so the page doesn't crash.
      setError("Can't reach the server — start the API (bun --hot src/index.ts in apps/api)");
      setBusy(false);
      return;
    }
    router.push("/app");
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <Link href="/" className="brand-wordmark">LAST<br />MILE</Link>
        <div>
          <p className="micro">Customer shipping</p>
          <h1>Your next delivery<br />starts here.</h1>
          <p>Set up one account to quote, book and follow every parcel.</p>
        </div>
        <span className="micro">Bengaluru / India</span>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <p className="micro">New customer</p>
          <h2>Create account</h2>
          <div className="space-y-4">
            <Field label="Full name">
              <input className="field" required minLength={2} value={form.name} onChange={set("name")} placeholder="Riya Sharma" />
            </Field>
            <Field label="Email">
              <input className="field" type="email" required value={form.email} onChange={set("email")} placeholder="you@company.dev" />
            </Field>
            <Field label="Phone">
              <input className="field" required value={form.phone} onChange={set("phone")} placeholder="+919800000000" />
            </Field>
            <Field label="Password (min 8 chars)">
              <input className="field" type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="••••••••" />
            </Field>
            {error && <ErrorNote error={error} />}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </div>
          <p className="text-sm text-[var(--color-muted)] mt-5">
            Already registered?{" "}
            <Link href="/login" className="font-medium underline underline-offset-4">Log in</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
