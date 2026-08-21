"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearSession, getUser, type SessionUser } from "@/lib/api";

/** Authenticated shell: guards by role, renders top nav, logs out. */
export function Shell({
  role,
  title,
  children,
}: {
  role: SessionUser["role"] | "ANY";
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = getUser();

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (role !== "ANY" && user.role !== role) {
      router.replace(user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/app");
    }
  }, [user, role, router]);

  if (!user) return null;

  function logout() {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/logout`, { method: "POST" }).catch(() => {});
    clearSession();
    router.push("/login");
  }

  const home = user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/app";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-line)] bg-[#fffdf8]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href={home} className="flex items-center gap-2 shrink-0">
            <span className="w-6 h-6 bg-[var(--color-signal)] text-white grid place-items-center rounded-[3px] font-display font-extrabold text-xs">L</span>
            <span className="font-display font-bold tracking-tight">{title}</span>
          </Link>
          <nav className="flex items-center gap-1 min-w-0">
            <NavLinks role={user.role} />
            <div className="hidden sm:block h-5 w-px bg-[var(--color-line-2)] mx-2" />
            <span className="micro hidden md:inline truncate max-w-40">{user.name}</span>
            <button onClick={logout} className="btn btn-ghost !py-1.5 !px-3 ml-1">Logout</button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
      <footer className="border-t border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <span className="micro">LastMile operations</span>
          <span className="micro">{user.role} session</span>
        </div>
      </footer>
    </div>
  );
}

function NavLinks({ role }: { role: string }) {
  const links =
    role === "ADMIN"
      ? [["Overview", "/admin"], ["Network", "/admin/network"], ["Pricing", "/admin/pricing"], ["Agents", "/admin/agents"]]
      : role === "AGENT"
        ? []
        : [["My orders", "/app"], ["New order", "/app/new"]];
  return (
    <>
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="font-mono text-[11px] tracking-[0.1em] uppercase px-3 py-1.5 rounded hover:bg-[var(--color-paper-2)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors whitespace-nowrap">
          {label}
        </Link>
      ))}
    </>
  );
}
