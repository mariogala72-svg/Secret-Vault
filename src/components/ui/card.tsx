import { cn } from "./cn";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-3xl p-6 sm:p-7", className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-gold-soft text-gold">{icon}</div>
      <h3 className="font-display text-xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", icon, children, className }: { tone?: "info" | "warning" | "danger" | "success"; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-accent/25 bg-accent/8 text-ink",
    warning: "border-warning/30 bg-warning/10 text-ink",
    danger: "border-danger/30 bg-danger/10 text-ink",
    success: "border-success/30 bg-success/10 text-ink",
  };
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed", tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
