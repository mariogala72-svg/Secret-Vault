import Link from "next/link";
import { Aurora } from "../ui/aurora";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "../ui/theme-toggle";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col px-4">
      <Aurora />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between py-5">
        <Link href="/" aria-label="Torna alla home">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-[32px] p-7 sm:p-9">
            <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
            {subtitle && <div className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</div>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
