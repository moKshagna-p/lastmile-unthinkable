"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, type SessionUser } from "@/lib/auth-client";
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
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Login failed");
        setBusy(false);
        return;
      }
      const user = data.user as unknown as SessionUser;
      router.push(user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/app");
    } catch {
      // Network-level failure (API down/unreachable): better-auth rejects
      // instead of resolving { error }; catch so the page doesn't crash.
      setError("Can't reach the server — start the API (bun --hot src/index.ts in apps/api)");
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <Link href="/" className="brand-wordmark">LAST<br />MILE</Link>
        <div>
          <p className="micro">One network / every handoff</p>
          <h1>Pick up where<br />you left off.</h1>
          <p>Customer, operations and rider access share one secure entry point.</p>
        </div>
        <span className="micro">Bengaluru / India</span>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <p className="micro">Account access</p>
          <h2>Log in</h2>
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
          <p className="text-sm text-[var(--color-muted)] mt-5">
            New here?{" "}
            <Link href="/register" className="font-medium underline underline-offset-4">
              Create a customer account
            </Link>
          </p>
          <details className="auth-demo">
            <summary className="cursor-pointer select-none w-fit micro hover:text-[var(--color-ink)]">
              Demo accounts · password <span className="font-mono text-[var(--color-ink)]">Password@123</span>
            </summary>
            <div className="grid gap-2 mt-3 font-mono text-xs">
              {[
                ["ADMIN", "admin@lastmile.dev"],
                ["CUSTOMER", "customer@lastmile.dev"],
                ["AGENT", "vikram@lastmile.dev"],
              ].map(([role, email]) => (
                <div key={role} className="flex items-center justify-between border-t border-[var(--color-rule)] px-1 py-2">
                  <span className="micro">{role}</span>
                  <span className="text-[var(--color-ink)]">{email}</span>
                </div>
              ))}
            </div>
          </details>
        </form>
      </section>
    </main>
  );
}
