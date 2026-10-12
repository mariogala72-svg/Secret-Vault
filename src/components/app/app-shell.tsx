"use client";
import { HeartHandshake, Home, Inbox, Lock, LockOpen, LogOut, Settings, Users, Vault } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Aurora } from "../ui/aurora";
import { ButtonLink } from "../ui/button";
import { cn } from "../ui/cn";
import { Logo, LogoMark } from "../ui/logo";
import { PageLoader } from "../ui/spinner";
import { ThemeToggle } from "../ui/theme-toggle";
import { useAuth } from "@/lib/client/auth";
import { useVault } from "@/lib/client/vault";

const NAV = [
  { href: "/app", label: "Panoramica", icon: Home, exact: true },
  { href: "/app/messages", label: "Cassaforte", icon: Vault },
  { href: "/app/contacts", label: "Rubrica", icon: Users },
  { href: "/app/trust", label: "Testamento digitale", short: "Fiducia", icon: HeartHandshake },
  { href: "/app/received", label: "Messaggi ricevuti", short: "Ricevuti", icon: Inbox },
  { href: "/app/settings", label: "Impostazioni", short: "Profilo", icon: Settings },
];

function VaultPill() {
  const { keys, lock, remainingMs } = useVault();
  if (!keys) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted">
        <Lock className="size-3.5" /> Cassaforte chiusa
      </span>
    );
  }
  const m = Math.max(0, Math.floor(remainingMs / 60000));
  const s = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  return (
    <button onClick={lock} className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/20" title="Blocca ora">
      <LockOpen className="size-3.5" /> Aperta · {m}:{String(s).padStart(2, "0")} <span className="hidden sm:inline">· Blocca</span>
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, me, loading, logout, configured } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!configured) return;
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!loading && user && me && !me.emailVerified) router.replace(`/verify-email?next=${encodeURIComponent(path)}`);
  }, [configured, loading, user, me, router, path]);

  if (loading || !user || !me || !me.emailVerified) return <PageLoader />;

  const active = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));
  const badge = (href: string) => (href === "/app/received" ? me.received?.unread : href === "/app/trust" ? me.pendingInvitations : 0) || 0;

  return (
    <div className="relative min-h-dvh lg:pl-72">
      <Aurora className="opacity-60" />
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-surface-solid/40 p-5 backdrop-blur-xl lg:flex">
        <Link href="/app" className="px-2 py-1"><Logo /></Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Navigazione principale">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] transition",
                active(n) ? "bg-surface-2 text-ink shadow-sm" : "text-muted hover:bg-surface-2/60 hover:text-ink",
              )}
              aria-current={active(n) ? "page" : undefined}
            >
              <n.icon className={cn("size-[18px]", active(n) && "text-accent")} />
              <span className="flex-1">{n.label}</span>
              {badge(n.href) > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{badge(n.href)}</span>}
            </Link>
          ))}
        </nav>
        <ButtonLink href="/app/messages/new" className="mb-4 w-full">Nuovo messaggio</ButtonLink>
        <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-brand font-display text-white">{me.displayName.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{me.displayName}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <button onClick={() => logout()} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink" aria-label="Esci">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-8">
        <Link href="/app" className="lg:hidden" aria-label="Panoramica"><LogoMark /></Link>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-1.5">
          <VaultPill />
          <ThemeToggle />
        </div>
      </header>

      {me.openCase && path !== "/app/trust" && (
        <div className="mx-4 mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm sm:mx-8">
          <strong>È in corso una verifica del tuo testamento digitale.</strong> Se stai bene, <Link href="/app/trust" className="font-semibold underline">fermala qui</Link>.
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-8 sm:px-8 lg:pb-16">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-3xl px-2 py-1.5 glass lg:hidden" aria-label="Navigazione principale">
        {NAV.filter((n) => n.href !== "/app/contacts").map((n) => (
          <Link key={n.href} href={n.href} className={cn("relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10.5px]", active(n) ? "text-accent" : "text-muted")}>
            <n.icon className="size-5" />
            {n.short ?? n.label}
            {badge(n.href) > 0 && <span className="absolute right-2 top-1 size-2 rounded-full bg-accent" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
