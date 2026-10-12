"use client";
import type { JSONContent } from "@tiptap/react";
import { CalendarHeart, Check, Copy, FileText, HeartHandshake, ImageIcon, Info, Lock, Paperclip, Plus, Printer, Send, Trash2, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, Notice } from "../ui/card";
import { cn } from "../ui/cn";
import { Field, Input, Textarea } from "../ui/field";
import { Modal } from "../ui/modal";
import { ContactModal } from "./contact-form";
import { RichEditor } from "./rich-editor";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { loadContacts, type Contact } from "@/lib/client/contacts";
import { fmtSize, newId, OCCASIONS } from "@/lib/client/format";
import { useVault } from "@/lib/client/vault";
import { aad, buildDelivery, encryptFileChunks, encryptText, MAX_MESSAGE_BYTES, validateFile, wrapDekForOwner } from "@/lib/crypto/message";
import type { AttachmentMeta, DeliveryInput, DeliveryView, MessageInput, Occasion, Trigger, TriggerKind } from "@/lib/types";

export type ComposerInitial = {
  id: string;
  dek: Uint8Array<ArrayBuffer>;
  ownerWrappedDek: string;
  title: string;
  body: JSONContent | null;
  attachments: (AttachmentMeta & { name: string; mime: string })[];
  trigger: Trigger;
  deliveries: DeliveryView[];
};

type Att = { id: string; name: string; mime: string; plainSize: number; progress: number; state: "uploading" | "done" | "error"; meta?: AttachmentMeta };
type Pick = { senderShares: boolean; codeHint: string };
type Mode = "date" | "death" | "manual";

const STEPS = ["Scrivi", "Allegati", "Destinatari", "Quando"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function localParts(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 86400e3);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: iso ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "09:00" };
}

export function Composer({ initial }: { initial?: ComposerInitial }) {
  const router = useRouter();
  const { user, me, refresh } = useAuth();
  const { keys } = useVault();
  const isEdit = !!initial;

  const [step, setStep] = useState(0);
  const id = useMemo(() => initial?.id ?? newId(), [initial]);
  const dekRef = useRef<Uint8Array<ArrayBuffer>>(initial?.dek ?? crypto.getRandomValues(new Uint8Array(32)));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState<JSONContent | null>(initial?.body ?? null);
  const [atts, setAtts] = useState<Att[]>(
    initial?.attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime, plainSize: a.size, progress: 1, state: "done", meta: { id: a.id, encMeta: a.encMeta, size: a.size, chunkCount: a.chunkCount } })) ?? [],
  );
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Record<string, Pick>>(() => {
    const p: Record<string, Pick> = {};
    for (const d of initial?.deliveries ?? []) p[d.contactId] = { senderShares: d.keyMode === "SENDER_SHARES_CODE", codeHint: "" };
    return p;
  });
  const [contactModal, setContactModal] = useState(false);

  const t0 = initial?.trigger;
  const [mode, setMode] = useState<Mode>(t0 ? (t0.kind === "DEATH" ? "death" : t0.kind.startsWith("MANUAL") ? "manual" : "date") : "date");
  const [occasion, setOccasion] = useState<Occasion>((t0?.occasion as Occasion) ?? "BIRTHDAY");
  const [{ date, time }, setDT] = useState(localParts(t0?.fireAt));
  const [orDeath, setOrDeath] = useState(t0?.kind === "DATE_OR_DEATH");
  const [manual, setManual] = useState<"MANUAL_NOW" | "MANUAL_LATER">(t0?.kind === "MANUAL_NOW" ? "MANUAL_NOW" : "MANUAL_LATER");
  const [saving, setSaving] = useState<null | "draft" | "schedule">(null);
  const [codesToShare, setCodesToShare] = useState<{ name: string; code: string }[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (keys && user) loadContacts(keys, user.uid).then(setContacts, () => setContacts([]));
  }, [keys, user]);

  const trigger: Trigger = useMemo(() => {
    if (mode === "manual") return { kind: manual };
    if (mode === "death") return { kind: "DEATH" };
    const fireAt = new Date(`${date}T${time || "09:00"}`).toISOString();
    return { kind: (orDeath ? "DATE_OR_DEATH" : "FIXED_DATE") as TriggerKind, fireAt, occasion };
  }, [mode, manual, date, time, orDeath, occasion]);

  const willReady = !!me?.deathSwitch?.enabled;
  const usedBytes = atts.reduce((n, a) => n + a.plainSize, 0);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const problem = await validateFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      if (usedBytes + file.size > MAX_MESSAGE_BYTES) {
        toast.error("Hai raggiunto il limite di 40 MB per messaggio");
        break;
      }
      if (atts.length >= 10) {
        toast.error("Massimo 10 allegati per messaggio");
        break;
      }
      const aid = newId();
      setAtts((a) => [...a, { id: aid, name: file.name, mime: file.type, plainSize: file.size, progress: 0, state: "uploading" }]);
      try {
        let count = 0, size = 0;
        for await (const chunk of encryptFileChunks(dekRef.current, aid, file)) {
          await api(`/api/attachments/${aid}/${chunk.n}?messageId=${id}`, { method: "PUT", body: chunk.data, headers: { "Content-Type": "application/octet-stream" } });
          count = chunk.count;
          size += chunk.data.length;
          setAtts((a) => a.map((x) => (x.id === aid ? { ...x, progress: (chunk.n + 1) / chunk.count } : x)));
        }
        const encMeta = await encryptText(dekRef.current, JSON.stringify({ name: file.name, mime: file.type, size: file.size }), aad.attMeta(aid));
        setAtts((a) => a.map((x) => (x.id === aid ? { ...x, state: "done", progress: 1, meta: { id: aid, encMeta, size, chunkCount: count } } : x)));
      } catch (e) {
        setAtts((a) => a.map((x) => (x.id === aid ? { ...x, state: "error" } : x)));
        toast.error(`${file.name}: ${errorMessage(e)}`);
      }
    }
  }

  function validate(intent: "draft" | "schedule"): string | null {
    if (!title.trim()) return "Dai un titolo al messaggio";
    if (atts.some((a) => a.state === "uploading")) return "Attendi il caricamento degli allegati";
    if (intent === "draft") return null;
    if (!body || !JSON.stringify(body).includes('"text"')) return "Il messaggio è vuoto";
    if (Object.keys(picked).length === 0) return "Scegli almeno un destinatario";
    if (trigger.fireAt && new Date(trigger.fireAt).getTime() < Date.now() + 60_000) return "Scegli una data futura";
    if ((mode === "death" || orDeath) && !willReady) return "Attiva prima il testamento digitale";
    return null;
  }

  async function save(intent: "draft" | "schedule") {
    if (!keys || !user) return;
    const problem = validate(intent);
    if (problem) return toast.error(problem);
    setSaving(intent);
    try {
      const dek = dekRef.current;
      const shared: { name: string; code: string }[] = [];
      const deliveries: DeliveryInput[] = [];
      for (const [contactId, p] of Object.entries(picked)) {
        const c = contacts?.find((x) => x.id === contactId);
        const existing = initial?.deliveries.find((d) => d.contactId === contactId);
        // A code already handed over in person must stay valid: keep that delivery as it is.
        if (existing && existing.keyMode === "SENDER_SHARES_CODE" && p.senderShares) {
          deliveries.push({ keepId: existing.id, contactId, name: existing.name, email: c?.email ?? "kept@example.com", keyMode: existing.keyMode, wrappedDek: "", codeSalt: "" });
          continue;
        }
        if (!c) continue;
        const { input, code } = await buildDelivery(dek, id, trigger, { contactId, name: c.name, email: c.email, phone: c.phone, senderShares: p.senderShares, codeHint: p.codeHint });
        deliveries.push(input);
        if (p.senderShares) shared.push({ name: c.name, code });
      }
      const payload: MessageInput = {
        id,
        intent,
        encTitle: await encryptText(dek, title.trim(), aad.title(id)),
        encBody: await encryptText(dek, JSON.stringify(body ?? {}), aad.body(id)),
        ownerWrappedDek: initial?.ownerWrappedDek ?? (await wrapDekForOwner(dek, keys.publicKey, id)),
        attachments: atts.filter((a) => a.state === "done" && a.meta).map((a) => a.meta!),
        trigger,
        deliveries,
      };
      await api(isEdit ? `/api/messages/${id}` : "/api/messages", { method: isEdit ? "PUT" : "POST", json: payload });
      await refresh();
      if (shared.length) {
        setCodesToShare(shared);
      } else {
        toast.success(intent === "draft" ? "Bozza salvata" : trigger.kind === "MANUAL_NOW" ? "Messaggio inviato 💌" : "Il tuo messaggio è al sicuro 🔐");
        router.push(`/app/messages/${id}`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "WILL_NOT_READY" ? e.message : errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const minDate = localParts(new Date().toISOString()).date;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{isEdit ? "Modifica messaggio" : "Nuovo messaggio"}</p>
          <h1 className="mt-1 font-display text-3xl font-medium sm:text-4xl">{STEPS[step]}</h1>
        </div>
        <ol className="flex items-center gap-2" aria-label="Avanzamento">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                onClick={() => setStep(i)}
                className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition", i === step ? "bg-gradient-brand text-white" : i < step ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="size-3.5" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <Field label="Titolo" hint="Lo vedrete solo tu e i destinatari: anche il titolo è cifrato.">
            {(fid) => <Input id={fid} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Per i tuoi 18 anni" className="h-14 font-display text-xl" />}
          </Field>
          <RichEditor value={body} onChange={setBody} />
          <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4 text-success" /> Cifrato sul tuo dispositivo prima di essere salvato.</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <button
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-surface/50 px-6 py-12 text-center transition hover:border-accent/60 hover:bg-accent/5"
          >
            <div className="grid size-14 place-items-center rounded-2xl bg-gradient-brand text-white"><Upload className="size-6" /></div>
            <p className="font-medium">Trascina qui foto o documenti, oppure scegli dal dispositivo</p>
            <p className="text-sm text-muted">PDF, Word, JPG, PNG · fino a 15 MB ciascuno, 40 MB in tutto</p>
          </button>
          <input ref={fileInput} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {atts.length > 0 && (
            <ul className="space-y-2">
              {atts.map((a) => (
                <li key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">{a.mime.startsWith("image/") ? <ImageIcon className="size-5 text-accent" /> : <FileText className="size-5 text-gold" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <div className={cn("h-full rounded-full transition-all", a.state === "error" ? "bg-danger" : "bg-gradient-brand")} style={{ width: `${Math.round(a.progress * 100)}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs text-muted">{a.state === "done" ? fmtSize(a.plainSize) : a.state === "error" ? "Errore" : `${Math.round(a.progress * 100)}%`}</span>
                    </div>
                  </div>
                  <button onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Rimuovi ${a.name}`}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted">Spazio usato: {(usedBytes / 1048576).toFixed(1)} MB di 40 MB · Gli allegati sono facoltativi.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {contacts === null ? (
            <div className="skeleton h-32 rounded-3xl" />
          ) : contacts.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted">La tua rubrica è vuota. Aggiungi la prima persona a cui vuoi scrivere.</p>
              <Button className="mt-4" onClick={() => setContactModal(true)}><UserPlus className="size-4" /> Aggiungi una persona</Button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => {
                const p = picked[c.id];
                return (
                  <li key={c.id} className={cn("rounded-3xl border p-4 transition sm:p-5", p ? "border-accent/50 bg-accent/5" : "border-line bg-surface")}>
                    <label className="flex cursor-pointer items-center gap-4">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--accent)]"
                        checked={!!p}
                        onChange={(e) =>
                          setPicked((x) => {
                            const n = { ...x };
                            if (e.target.checked) n[c.id] = { senderShares: false, codeHint: "" };
                            else delete n[c.id];
                            return n;
                          })
                        }
                      />
                      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-soft font-display text-gold">{c.name.slice(0, 1).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}{c.relation && <span className="font-normal text-muted"> · {c.relation}</span>}</p>
                        <p className="truncate text-sm text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                      </div>
                    </label>
                    {p && (
                      <div className="mt-4 space-y-3 border-t border-line pt-4 sm:pl-9">
                        <p className="text-sm font-medium">Il codice di accesso:</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {[
                            { v: false, t: "Lo custodisce Secret Vault", d: mode === "date" && !orDeath ? "Sigillato a tempo: nessuno potrà aprirlo prima della data." : "Lo invieremo noi insieme all'invito, al momento giusto." },
                            { v: true, t: "Glielo darò io", d: "Massima riservatezza: il codice non passa mai da noi in chiaro." },
                          ].map((o) => (
                            <button
                              key={String(o.v)}
                              type="button"
                              onClick={() => setPicked((x) => ({ ...x, [c.id]: { ...x[c.id], senderShares: o.v } }))}
                              className={cn("rounded-2xl border p-3 text-left transition", p.senderShares === o.v ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}
                            >
                              <p className="text-sm font-medium">{o.t}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-muted">{o.d}</p>
                            </button>
                          ))}
                        </div>
                        {p.senderShares && (
                          <Textarea
                            rows={2}
                            maxLength={300}
                            placeholder="Facoltativo: dove troverà il codice (es. «nella busta nel cassetto della scrivania»)"
                            value={p.codeHint}
                            onChange={(e) => setPicked((x) => ({ ...x, [c.id]: { ...x[c.id], codeHint: e.target.value } }))}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {contacts && contacts.length > 0 && (
            <Button variant="secondary" onClick={() => setContactModal(true)}><Plus className="size-4" /> Aggiungi una persona</Button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {([
              { m: "date", icon: CalendarHeart, t: "In una data speciale", d: "Compleanno, anniversario, un traguardo." },
              { m: "death", icon: HeartHandshake, t: "Quando non ci sarò più", d: "Con il tuo testamento digitale." },
              { m: "manual", icon: Send, t: "Lo invierò io", d: "Adesso, o quando lo deciderai." },
            ] as const).map((o) => (
              <button key={o.m} type="button" onClick={() => setMode(o.m)} className={cn("rounded-3xl border p-5 text-left transition", mode === o.m ? "border-accent bg-accent/10 shadow-lg" : "border-line bg-surface hover:border-line-strong")} aria-pressed={mode === o.m}>
                <o.icon className={cn("size-6", mode === o.m ? "text-accent" : "text-gold")} />
                <p className="mt-3 font-medium">{o.t}</p>
                <p className="mt-1 text-sm text-muted">{o.d}</p>
              </button>
            ))}
          </div>

          <Card>
            {mode === "date" && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(OCCASIONS) as Occasion[]).map((o) => (
                    <button key={o} type="button" onClick={() => setOccasion(o)} className={cn("rounded-full border px-4 py-1.5 text-sm transition", occasion === o ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink")}>
                      {OCCASIONS[o]}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Data">{(fid) => <Input id={fid} type="date" min={minDate} value={date} onChange={(e) => setDT({ date: e.target.value, time })} />}</Field>
                  <Field label="Ora" hint={`Fuso orario: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}>{(fid) => <Input id={fid} type="time" value={time} onChange={(e) => setDT({ date, time: e.target.value })} />}</Field>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={orDeath} onChange={(e) => setOrDeath(e.target.checked)} />
                  <span>…oppure prima, se non dovessi più esserci <span className="text-muted">(richiede il testamento digitale)</span></span>
                </label>
              </div>
            )}
            {mode === "death" && (
              <div className="space-y-3 text-[15px] leading-relaxed">
                <p>Il messaggio resterà custodito finché le tue persone di fiducia non confermeranno la tua scomparsa e sarà trascorso il periodo di attesa in cui potrai sempre annullare.</p>
                {!willReady && (
                  <Notice tone="warning" icon={<Info className="size-4 text-warning" />}>
                    Per usare questa opzione attiva prima il <Link href="/app/trust" className="font-semibold underline">testamento digitale</Link>. Puoi intanto salvare il messaggio come bozza.
                  </Notice>
                )}
              </div>
            )}
            {mode === "manual" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["MANUAL_LATER", "Quando lo deciderò", "Resterà pronto: potrai inviarlo con un clic."],
                  ["MANUAL_NOW", "Adesso", "I destinatari riceveranno subito l'invito."],
                ] as const).map(([v, t, d]) => (
                  <button key={v} type="button" onClick={() => setManual(v)} className={cn("rounded-2xl border p-4 text-left transition", manual === v ? "border-accent bg-accent/10" : "border-line hover:border-line-strong")}>
                    <p className="font-medium">{t}</p>
                    <p className="mt-1 text-sm text-muted">{d}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-gold-soft/40">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Riepilogo</p>
            <p className="mt-2 font-display text-xl">“{title || "Senza titolo"}”</p>
            <p className="mt-1 text-sm text-muted">
              Per {Object.keys(picked).map((cid) => contacts?.find((c) => c.id === cid)?.name ?? initial?.deliveries.find((d) => d.contactId === cid)?.name).filter(Boolean).join(", ") || "nessun destinatario"}
              {" · "}{atts.length} {atts.length === 1 ? "allegato" : "allegati"}
            </p>
          </Card>
        </div>
      )}

      <div className="sticky bottom-24 z-10 mt-8 flex items-center gap-2 rounded-full p-2 glass lg:bottom-4">
        {step > 0 ? <Button variant="ghost" onClick={back}>Indietro</Button> : <Button variant="ghost" onClick={() => router.back()}>Annulla</Button>}
        <span className="flex-1" />
        <Button variant="secondary" onClick={() => save("draft")} loading={saving === "draft"} disabled={!!saving}>Salva bozza</Button>
        {step < 3 ? (
          <Button onClick={next}>Avanti</Button>
        ) : (
          <Button onClick={() => save("schedule")} loading={saving === "schedule"} disabled={!!saving}>
            <Lock className="size-4" /> {mode === "manual" && manual === "MANUAL_NOW" ? "Invia ora" : "Programma"}
          </Button>
        )}
      </div>

      {contactModal && (
        <ContactModal
          open
          smsEnabled={me?.smsEnabled}
          onClose={() => setContactModal(false)}
          onSaved={(c) => {
            setContacts((l) => [...(l ?? []), c].sort((a, b) => a.name.localeCompare(b.name, "it")));
            setPicked((x) => ({ ...x, [c.id]: { senderShares: false, codeHint: "" } }));
          }}
        />
      )}

      <Modal open={!!codesToShare} onClose={() => router.push(`/app/messages/${id}`)} title="Codici da consegnare" wide>
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-muted">Hai scelto di consegnare tu i codici. <strong className="text-ink">Questa è l&apos;unica volta che li vedrai</strong>: scrivili o stampali e conservali in un luogo sicuro.</p>
          <ul className="space-y-2">
            {codesToShare?.map((c) => (
              <li key={c.name} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-solid/60 p-4 sm:flex-row sm:items-center">
                <span className="flex-1 font-medium">{c.name}</span>
                <code className="rounded-xl bg-[#14131c] px-3 py-2 font-mono text-base tracking-wider text-[#f5e6d3]">{c.code}</code>
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(c.code).then(() => toast.success("Copiato"))}><Copy className="size-4" /></Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Stampa</Button>
            <Button onClick={() => router.push(`/app/messages/${id}`)}><Paperclip className="size-4" /> Li ho conservati</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
