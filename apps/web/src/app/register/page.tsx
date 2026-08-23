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
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rise">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="w-7 h-7 bg-[var(--color-signal)] text-white grid place-items-center rounded-[3px] font-display font-bold text-sm">L</span>
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
