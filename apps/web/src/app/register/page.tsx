"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setSession, type SessionUser } from "@/lib/api";
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
    try {
      const res = await api<{ token: string; user: SessionUser }>("/auth/register", {
        method: "POST",
        body: form,
      });
      setSession(res.token, res.user);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rise">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="w-7 h-7 bg-[var(--color-signal)] text-white grid place-items-center rounded-[3px] font-display font-extrabold text-sm">L</span>
          <span className="font-display font-bold tracking-tight text-lg">LastMile</span>
        </Link>
        <form onSubmit={submit} className="card p-7">
          <h1 className="font-display font-bold text-2xl tracking-tight">Create account</h1>
          <p className="micro mt-1 mb-6">Customer registration</p>
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
          <p className="text-sm text-[var(--color-ink-2)] mt-5 text-center">
            Already registered?{" "}
            <Link href="/login" className="text-[var(--color-signal)] font-medium hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
