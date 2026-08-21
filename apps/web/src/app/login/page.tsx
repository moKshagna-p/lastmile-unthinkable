"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setSession, type SessionUser } from "@/lib/api";
import { ErrorNote, Field } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: SessionUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSession(res.token, res.user);
      router.push(res.user.role === "ADMIN" ? "/admin" : res.user.role === "AGENT" ? "/agent" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
          <h1 className="font-display font-bold text-2xl tracking-tight">Log in</h1>
          <p className="micro mt-1 mb-6">Customers · agents · admins</p>
          <div className="space-y-4">
            <Field label="Email">
              <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.dev" />
            </Field>
            <Field label="Password">
              <input className="field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {error && <ErrorNote error={error} />}
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Checking…" : "Log in"}
            </button>
          </div>
          <p className="text-sm text-[var(--color-ink-2)] mt-5 text-center">
            New here?{" "}
            <Link href="/register" className="text-[var(--color-signal)] font-medium hover:underline">
              Create a customer account
            </Link>
          </p>
        </form>
        <p className="micro text-center mt-5">demo · admin@lastmile.dev / Password@123</p>
      </div>
    </main>
  );
}
