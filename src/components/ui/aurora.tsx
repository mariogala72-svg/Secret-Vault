export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`} aria-hidden>
      <div className="animate-float-a absolute -left-[10%] -top-[20%] h-[60vmax] w-[60vmax] rounded-full blur-[120px]" style={{ background: "var(--aurora-1)" }} />
      <div className="animate-float-b absolute -right-[15%] top-[10%] h-[50vmax] w-[50vmax] rounded-full blur-[120px]" style={{ background: "var(--aurora-2)" }} />
      <div className="animate-float-a absolute bottom-[-25%] left-[25%] h-[45vmax] w-[45vmax] rounded-full blur-[130px]" style={{ background: "var(--aurora-3)" }} />
    </div>
  );
}
