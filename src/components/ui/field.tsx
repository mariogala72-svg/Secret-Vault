"use client";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState } from "react";
import { cn } from "./cn";

const inputBase =
  "w-full rounded-2xl border border-line bg-surface-solid/60 px-4 h-12 text-[15px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "h-auto min-h-24 py-3 leading-relaxed", className)} {...rest} />;
});

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? "text" : "password"} className={cn(inputBase, "pr-12", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-full text-faint hover:text-ink"
        aria-label={show ? "Nascondi password" : "Mostra password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string | null; children: (id: string) => React.ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputBase, "appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}
