"use client";
import { ArrowRight, CalendarClock, HeartHandshake, Inbox, Lock, LockOpen, PenLine, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { fmtDate, fmtRelative } from "@/lib/client/format";
import { useVault } from "@/lib/client/vault";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export default function Dashboard() {
  const { me, refresh } = useAuth();
  const { keys } = useVault();
  if (!me) return null;
  const c = me.counts ?? {};
  const sw = me.deathSwitch;

  const stats = [
    { label: "Bozze", value: c.DRAFT ?? 0, icon: PenLine },
    { label: "Programmati", value: (c.SCHEDULED ?? 0) + (c.HOLD ?? 0), icon: CalendarClock },
    { label: "Testamento", value: c.ARMED ?? 0, icon: HeartHandshake },
    { label: "Consegnati", value: (c.DELIVERED ?? 0) + (c.PARTIAL ?? 0), icon: Send },
  ];

  async function checkIn() {
    try {
      await api("/api/trust/checkin", { method: "POST" });
      await refresh();
      toast.success("Grazie! Ci risentiamo più avanti 💛");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          {greeting()}, <span className="text-gradient italic">{me.displayName.split(" ")[0]}</span>.
        </h1>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${keys ? "bg-success/15 text-success" : "bg-gradient-brand text-white"} shadow-lg`}>
            {keys ? <LockOpen className="size-7" /> : <Lock className="size-7" />}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl">{!me.hasVault ? "Crea la tua cassaforte" : keys ? "La tua cassaforte è aperta" : "La tua cassaforte è chiusa"}</h2>
            <p className="mt-1 text-[15px] text-muted">
              {!me.hasVault
                ? "Il primo passo: scegli la password che proteggerà i tuoi messaggi."
                : keys
                  ? "Si richiuderà da sola dopo 10 minuti di inattività."
                  : "I tuoi messaggi sono protetti da una seconda password."}
            </p>
          </div>
          <ButtonLink href="/app/messages">
            {!me.hasVault ? "Inizia" : keys ? "Vai ai messaggi" : "Apri la cassaforte"} <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href="/app/messages" className="glass rounded-3xl p-5 transition hover:-translate-y-0.5">
            <s.icon className="size-5 text-gold" />
            <p className="mt-4 font-display text-4xl">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <HeartHandshake className="size-5 text-gold" />
            <h2 className="font-display text-xl">Testamento digitale</h2>
          </div>
          {sw?.enabled ? (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted">Ultimo segnale</dt>
                  <dd className="mt-0.5 font-medium">{fmtDate(sw.lastCheckinAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Prossimo entro</dt>
                  <dd className="mt-0.5 font-medium">{fmtDate(sw.nextDueAt)}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="gold" onClick={checkIn}>Sono qui ✓</Button>
                <ButtonLink href="/app/trust" variant="ghost">Gestisci</ButtonLink>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">Scegli le persone di fiducia e attiva il controllo periodico, per poter lasciare messaggi da consegnare quando non ci sarai più.</p>
              <ButtonLink href="/app/trust" variant="gold" className="mt-5">Configura</ButtonLink>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Inbox className="size-5 text-accent" />
            <h2 className="font-display text-xl">Messaggi per te</h2>
          </div>
          {me.received?.total ? (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">
                Hai {me.received.total} {me.received.total === 1 ? "messaggio" : "messaggi"}
                {me.received.unread ? `, di cui ${me.received.unread} ancora da aprire` : ""}.
              </p>
              <ButtonLink href="/app/received" className="mt-5">Apri</ButtonLink>
            </>
          ) : (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">Nessun messaggio per te, per ora. Se qualcuno ti lascerà un pensiero, lo troverai qui.</p>
          )}
          {me.pendingInvitations ? (
            <Link href="/app/trust" className="mt-5 flex items-center gap-2 rounded-2xl bg-gold-soft p-3 text-sm text-gold">
              <Sparkles className="size-4" /> {me.pendingInvitations} {me.pendingInvitations === 1 ? "persona ti ha scelto" : "persone ti hanno scelto"} come persona di fiducia
            </Link>
          ) : null}
        </Card>
      </div>

      {sw?.enabled && sw.nextDueAt && <p className="text-center text-xs text-faint">Ti chiederemo un segnale {fmtRelative(sw.nextDueAt)}. Anche accedere al profilo conta.</p>}
    </div>
  );
}
