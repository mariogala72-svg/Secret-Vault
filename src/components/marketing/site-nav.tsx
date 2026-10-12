"use client";
import Link from "next/link";
import { useAuth } from "@/lib/client/auth";
import { ButtonLink } from "../ui/button";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "../ui/theme-toggle";

export function SiteNav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-3 py-2 sm:px-4 glass">
        <Link href="/" aria-label="Secret Vault, home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#come-funziona" className="hover:text-ink">Come funziona</a>
          <a href="#sicurezza" className="hover:text-ink">Sicurezza</a>
          <a href="#testamento" className="hover:text-ink">Testamento digitale</a>
          <a href="#faq" className="hover:text-ink">Domande</a>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <ButtonLink href="/app" size="sm">La mia cassaforte</ButtonLink>
          ) : (
            <>
              <span className="hidden sm:block">
                <ButtonLink href="/login" variant="ghost" size="sm">Accedi</ButtonLink>
              </span>
              <ButtonLink href="/register" size="sm">Inizia</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
