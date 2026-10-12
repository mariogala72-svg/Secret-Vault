"use client";
import { Lock, Mail } from "lucide-react";
import { motion } from "motion/react";

export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      {/* concentric dial rings */}
      <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-line-strong" />
      <svg viewBox="0 0 100 100" className="absolute inset-[9%] text-line-strong" style={{ animation: "spin-slow 60s linear infinite reverse" }} aria-hidden>
        <circle cx="50" cy="50" r="49" fill="none" stroke="currentColor" strokeWidth=".3" />
        {Array.from({ length: 48 }).map((_, i) => (
          <line key={i} x1="50" y1="1.5" x2="50" y2={i % 4 === 0 ? 5.5 : 3.5} stroke="currentColor" strokeWidth={i % 4 === 0 ? 0.6 : 0.3} transform={`rotate(${i * 7.5} 50 50)`} />
        ))}
      </svg>
      <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-accent/25 via-transparent to-gold/25 blur-2xl" />

      {/* the sealed letter */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        className="glass absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] p-6"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-gold">
            <Lock className="size-3.5" /> Sigillato
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted">AES-256</span>
        </div>
        <p className="mt-5 font-display text-2xl leading-snug">Per i tuoi 18 anni</p>
        <div className="mt-4 space-y-2" aria-hidden>
          <div className="h-2.5 w-full rounded-full bg-surface-2" />
          <div className="h-2.5 w-[86%] rounded-full bg-surface-2" />
          <div className="h-2.5 w-[64%] rounded-full bg-surface-2" />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface-solid/50 p-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-white">
            <Mail className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Per Tommaso</p>
            <p className="text-xs text-muted">Si aprirà il 14 marzo 2034 · 9:00</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="glass absolute -right-2 top-[12%] rounded-2xl px-4 py-3 text-sm sm:-right-6"
      >
        <p className="font-medium">🔐 Cifrato sul tuo dispositivo</p>
        <p className="text-xs text-muted">Nemmeno noi possiamo leggerlo</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="glass absolute -left-2 bottom-[10%] rounded-2xl px-4 py-3 text-sm sm:-left-8"
      >
        <p className="font-medium">💛 Testamento digitale</p>
        <p className="text-xs text-muted">2 persone di fiducia confermate</p>
      </motion.div>
    </div>
  );
}
