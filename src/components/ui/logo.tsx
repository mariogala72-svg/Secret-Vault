import { cn } from "./cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="sv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7cf6" />
          <stop offset=".55" stopColor="#a77fd6" />
          <stop offset="1" stopColor="#e0b07a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#sv-g)" />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="#fff" />
      {[0, 90, 180, 270].map((r) => (
        <rect key={r} x="19.2" y="7.6" width="1.6" height="3.4" rx=".8" fill="#fff" fillOpacity=".85" transform={`rotate(${r} 20 20)`} />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="whitespace-nowrap font-display text-xl font-medium tracking-tight">Secret Vault</span>
    </span>
  );
}
