"use client";
import { AlertTriangle, Check, HeartHandshake, Plus, ShieldCheck, Trash2, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ReauthModal } from "@/components/app/reauth-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { fmtDate } from "@/lib/client/format";
import type { DeathSwitch } from "@/lib/types";

type TrustData = {
  settings: DeathSwitch;
  effectiveQuorum: number;
  executors: { id: string; name: string; emailMasked: string; status: "INVITED" | "ACCEPTED" | "DECLINED" }[];
  openCase: { id: string; status: string; reason: string; contestUntil: string | null; confirmations: number } | null;
  trustedBy: { id: string; ownerName: string; status: "INVITED" | "ACCEPTED"; ownerDeceased: boolean; pendingCase: { id: string; status: string; myDecision: string | null } | null }[];
};

const EXEC_STATUS = { INVITED: ["Invito inviato", "neutral"], ACCEPTED: ["Ha accettato", "success"], DECLINED: ["Ha rinunciato", "danger"] } as const;

export default function TrustPage() {
  const { refresh } = useAuth();
  const [d, setD] = useState<TrustData | null>(null);
  const [form, setForm] = useState<Pick<DeathSwitch, "enabled" | "intervalDays" | "quorum" | "contestHours" | "allowUnattended"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState(false);
  const [inv, setInv] = useState({ name: "", email: "" });
  const [inviting, setInviting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    api<TrustData>("/api/trust").then(
      (r) => {
        setD(r);
        setForm({ enabled: r.settings.enabled, intervalDays: r.settings.intervalDays, quorum: r.settings.quorum, contestHours: r.settings.contestHours, allowUnattended: r.settings.allowUnattended });
      },
      (e) => toast.error(errorMessage(e)),
    );
  }, [version]);

  if (!d || !form) return <PageLoader />;
  const accepted = d.executors.filter((e) => e.status === "ACCEPTED").length;

  async function save() {
    if (form!.enabled && accepted === 0 && !form!.allowUnattended) {
      return toast.error("Aggiungi almeno una persona di fiducia che abbia accettato, oppure consenti la consegna senza conferme");
    }
    setSaving(true);
    try {
      await api("/api/trust", { method: "PUT", json: form });
      await Promise.all([load(), refresh()]);
      toast.success(form!.enabled ? "Testamento digitale attivo 💛" : "Impostazioni salvate");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api("/api/trust/executors", { method: "POST", json: inv });
      toast.success(`Invito inviato a ${inv.name}`);
      setInv({ name: "", email: "" });
      setInvite(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`Rimuovere ${name} dalle persone di fiducia?`)) return;
    await api(`/api/trust/executors/${id}`, { method: "DELETE" }).catch((e) => toast.error(errorMessage(e)));
    load();
  }

  async function respondInvite(id: string, accept: boolean) {
    try {
      await api(`/api/trust/invitations/${id}`, { method: "POST", json: { accept } });
      toast.success(accept ? "Grazie per la tua disponibilità 💛" : "Hai rinunciato all'incarico");
      await Promise.all([load(), refresh()]);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function decide(caseId: string, decision: "CONFIRM" | "DENY", ownerName: string) {
    const text = decision === "CONFIRM" ? `Confermi, con la massima certezza, che ${ownerName} è venuto a mancare?` : `Confermi che ${ownerName} sta bene, o che non ne hai la certezza?`;
    if (!confirm(text)) return;
    try {
      await api(`/api/trust/cases/${caseId}`, { method: "POST", json: { decision } });
      toast.success("Grazie. Abbiamo registrato la tua risposta.");
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Testamento digitale" title="Quando non ci sarai più" description="Nessun segnale da solo può sbloccare i tuoi messaggi: servono il tuo silenzio prolungato, la conferma delle persone di fiducia e un tempo di attesa in cui puoi sempre fermare tutto." />

      {d.openCase && (
        <Card className="border-danger/40 bg-danger/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-8 shrink-0 text-danger" />
            <div className="flex-1">
              <h2 className="font-display text-xl">È in corso una verifica</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {d.openCase.status === "CONTEST"
                  ? `Le tue persone di fiducia hanno confermato. Se non annulli, i messaggi verranno consegnati dopo il ${fmtDate(d.openCase.contestUntil, true)}.`
                  : d.openCase.status === "NEEDS_REVIEW"
                    ? "Non riceviamo tuoi segnali da tempo. Nessun messaggio verrà consegnato senza persone di fiducia."
                    : `Abbiamo chiesto conferma alle tue persone di fiducia (${d.openCase.confirmations}/${d.effectiveQuorum}).`}
              </p>
            </div>
            <Button variant="danger" onClick={() => setCancelOpen(true)}>Sto bene, annulla</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">Controllo periodico</h2>
              <p className="mt-1 text-sm text-muted">Ogni tanto ti chiederemo un segnale. Anche un accesso al profilo conta.</p>
            </div>
            <button
              role="switch"
              aria-checked={form.enabled}
              aria-label="Attiva il testamento digitale"
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={cn("relative h-8 w-14 shrink-0 rounded-full transition", form.enabled ? "bg-gradient-brand" : "bg-line-strong")}
            >
              <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-all", form.enabled ? "left-7" : "left-1")} />
            </button>
          </div>
          <div className={cn("mt-6 space-y-5 transition", !form.enabled && "pointer-events-none opacity-50")}>
            <Field label="Chiedimi un segnale ogni">
              {(id) => (
                <Select id={id} value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: Number(e.target.value) })}>
                  {[30, 60, 90, 180, 365].map((n) => <option key={n} value={n}>{n === 365 ? "anno" : `${n} giorni`}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Conferme necessarie" hint={accepted ? `Su ${accepted} ${accepted === 1 ? "persona che ha accettato" : "persone che hanno accettato"}.` : "Aggiungi prima le persone di fiducia."}>
              {(id) => (
                <Select id={id} value={form.quorum} onChange={(e) => setForm({ ...form, quorum: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? "conferma" : "conferme"}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Tempo per ripensarci" hint="Dopo le conferme, aspetteremo ancora cercandoti su tutti i canali.">
              {(id) => (
                <Select id={id} value={form.contestHours} onChange={(e) => setForm({ ...form, contestHours: Number(e.target.value) })}>
                  {[[24, "24 ore"], [72, "3 giorni"], [168, "7 giorni"], [336, "14 giorni"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-relaxed">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={form.allowUnattended} onChange={(e) => setForm({ ...form, allowUnattended: e.target.checked })} />
              <span>
                <strong>Consenti la consegna anche senza persone di fiducia.</strong> <span className="text-muted">Se non rispondi per oltre 30 giorni dopo la scadenza, attenderemo altri 14 giorni e poi consegneremo. È meno sicuro: un lungo ricovero potrebbe essere scambiato per la tua scomparsa.</span>
              </span>
            </label>
            {d.settings.enabled && (
              <p className="text-sm text-muted">Ultimo segnale: <strong className="text-ink">{fmtDate(d.settings.lastCheckinAt)}</strong> · Prossimo entro: <strong className="text-ink">{fmtDate(d.settings.nextDueAt)}</strong></p>
            )}
          </div>
          <Button className="mt-6" onClick={save} loading={saving}>Salva</Button>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Persone di fiducia</h2>
            <Button size="sm" variant="secondary" onClick={() => setInvite(true)} disabled={d.executors.length >= 5}><Plus className="size-4" /> Invita</Button>
          </div>
          <p className="mt-1 text-sm text-muted">Confermeranno con delicatezza la tua scomparsa. Non vedranno mai i messaggi né i destinatari.</p>
          {d.executors.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              <HeartHandshake className="mx-auto mb-3 size-8 text-gold" />
              Scegli da 1 a 5 persone vicine a te: un familiare, un amico, il tuo notaio.
            </div>
          ) : (
            <ul className="mt-5 space-y-2">
              {d.executors.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft font-display text-gold">{e.name.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted">{e.emailMasked}</p>
                  </div>
                  <Badge tone={EXEC_STATUS[e.status][1]}>{EXEC_STATUS[e.status][0]}</Badge>
                  <button onClick={() => revoke(e.id, e.name)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Rimuovi ${e.name}`}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {d.trustedBy.length > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <UserCheck className="size-5 text-accent" />
            <h2 className="font-display text-2xl">Chi si fida di te</h2>
          </div>
          <ul className="mt-5 space-y-3">
            {d.trustedBy.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="flex-1">
                    <strong>{t.ownerName}</strong>{" "}
                    <span className="text-muted">{t.status === "INVITED" ? "ti ha scelto come persona di fiducia." : t.ownerDeceased ? "· i suoi messaggi sono stati consegnati." : "· sei una sua persona di fiducia."}</span>
                  </p>
                  {t.status === "INVITED" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respondInvite(t.id, true)}><Check className="size-4" /> Accetto</Button>
                      <Button size="sm" variant="ghost" onClick={() => respondInvite(t.id, false)}><X className="size-4" /> Rinuncio</Button>
                    </div>
                  )}
                </div>
                {t.pendingCase && (
                  <div className="mt-4 rounded-2xl bg-gold-soft/60 p-4">
                    <p className="text-sm leading-relaxed">
                      Non riusciamo a metterci in contatto con {t.ownerName} da tempo. Se è venuto a mancare, ti chiediamo, se te la senti, di confermarlo. Se sta bene o non ne sei certo, indicalo: non verrà consegnato nulla.
                    </p>
                    {t.pendingCase.myDecision || t.pendingCase.status === "CONTEST" ? (
                      <p className="mt-3 text-sm font-medium">
                        {t.pendingCase.myDecision ? `Hai risposto: ${t.pendingCase.myDecision === "CONFIRM" ? "confermo la scomparsa" : "sta bene / non ne sono certo"}.` : "Le conferme necessarie sono state raccolte."}
                        {t.pendingCase.status === "CONTEST" && " Prima di qualsiasi consegna attendiamo il periodo di ripensamento scelto da " + t.ownerName + "."}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => decide(t.pendingCase!.id, "DENY", t.ownerName)}>Sta bene / Non ne sono certo</Button>
                        <Button size="sm" variant="danger" onClick={() => decide(t.pendingCase!.id, "CONFIRM", t.ownerName)}>Confermo la scomparsa</Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Notice tone="info" icon={<ShieldCheck className="size-4 text-accent" />}>
        Secret Vault custodisce parole e ricordi, ma non sostituisce un testamento legale. Per disposizioni sui tuoi beni rivolgiti a un notaio.
      </Notice>

      <Modal open={invite} onClose={() => setInvite(false)} title="Invita una persona di fiducia">
        <form onSubmit={sendInvite} className="space-y-4">
          <Field label="Nome">{(id) => <Input id={id} required value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} />}</Field>
          <Field label="Email" hint="Riceverà un invito che potrà accettare o rifiutare.">{(id) => <Input id={id} type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />}</Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInvite(false)}>Annulla</Button>
            <Button type="submit" loading={inviting}>Invia invito</Button>
          </div>
        </form>
      </Modal>

      <ReauthModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Ferma la verifica"
        description="Inserisci la tua password per confermare che sei tu. Il timer ripartirà da oggi."
        confirmLabel="Sto bene, annulla"
        onConfirmed={async () => {
          await api("/api/trust/cancel", { method: "POST" });
          toast.success("Verifica annullata. Siamo felici di sentirti 💛");
          await Promise.all([load(), refresh()]);
        }}
      />
    </div>
  );
}
