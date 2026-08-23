"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bike, LayoutDashboard, Network, Package, PlusCircle, ReceiptText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { activeNavHref } from "@/lib/ui-state";

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
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as unknown as SessionUser | undefined;

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "ANY" && user.role !== role) {
      router.replace(user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/app");
    }
  }, [isPending, user, role, router]);

  if (isPending || !user) {
    return (
      <div className="min-h-screen grid place-items-center" role="status" aria-live="polite">
        <div className="text-center">
          <span className="inline-block w-6 h-6 border-2 border-[var(--color-line-2)] border-t-[var(--color-ink)] rounded-full animate-spin" aria-hidden />
          <p className="micro mt-3">Restoring session…</p>
        </div>
      </div>
    );
  }

  async function logout() {
    try {
      await authClient.signOut();
    } catch {
      // API unreachable — proceed to /login regardless; the session guard
      // in this component handles any stale cookie on next load.
    }
    router.push("/login");
  }

  const home = user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/app";

  return (
    <div className="app-shell" data-role={user.role.toLowerCase()}>
      <aside className="shell-rail">
        <Link href={home} className="brand-wordmark">LAST<br />MILE</Link>
        <div>
          <p className="micro mb-4">{title}</p>
          <nav className="shell-rail-nav" aria-label="Primary navigation">
            <NavLinks role={user.role} pathname={pathname} />
          </nav>
        </div>
        <div className="shell-rail-user">
          <span className="micro">{user.name}<br />{user.role}</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </aside>

      <div className="shell-stage">
        <header className="shell-top">
          <Link href={home} className="brand-wordmark">LASTMILE</Link>
          <nav className="shell-top-nav" aria-label="Primary navigation">
            <NavLinks role={user.role} pathname={pathname} />
          </nav>
          <div className="shell-account">
            <span className="micro hidden sm:inline">{user.name}</span>
            <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        </header>
        <main className="shell-content">{children}</main>
        <footer className="shell-footer">
          <span>LASTMILE / OPERATIONS</span>
          <span>{user.role} SESSION</span>
        </footer>
      </div>
    </div>
  );
}

function NavLinks({ role, pathname }: { role: string; pathname: string }) {
  const links: Array<[string, string, LucideIcon]> =
    role === "ADMIN"
      ? [
          ["Overview", "/admin", LayoutDashboard],
          ["Network", "/admin/network", Network],
          ["Pricing", "/admin/pricing", ReceiptText],
          ["Agents", "/admin/agents", Users],
        ]
      : role === "AGENT"
        ? [["Run sheet", "/agent", Bike]]
        : [
            ["My orders", "/app", Package],
            ["New order", "/app/new", PlusCircle],
          ];
  const activeHref = activeNavHref(pathname, links.map(([, href]) => href));
  return (
    <>
      {links.map(([label, href, Icon]) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shell-nav-link ${
              active
                ? "shell-nav-link-active"
                : ""
            }`}
          >
            <Icon size={13} strokeWidth={active ? 2.2 : 1.75} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
