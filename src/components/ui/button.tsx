"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[.98] whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-brand text-white shadow-[0_8px_30px_-8px_rgba(109,91,208,.7)] hover:shadow-[0_12px_40px_-8px_rgba(109,91,208,.85)] hover:brightness-110",
  secondary: "glass text-ink hover:border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  gold: "bg-gold-soft text-gold border border-gold/30 hover:border-gold/60",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
