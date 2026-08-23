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
      </div>
    </main>
  );
}
