"use client";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, HeartHandshake, KeyRound, MailQuestion, Printer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AttachmentList, type PlainAttachment } from "@/components/vault/attachment-list";
import { RichViewer } from "@/components/vault/rich-editor";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { fmtDate } from "@/lib/client/format";
import { decryptAttachmentMetas } from "@/lib/client/messages";
import { isWellFormedCode } from "@/lib/crypto/code";
import { aad, decryptText, unwrapRecipientDek } from "@/lib/crypto/message";
import type { AttachmentMeta, KeyMode } from "@/lib/types";

type Payload = {
  id: string; messageId: string; senderName: string; postMortem: boolean; writtenAt: string; sentAt: string; openedAt: string | null;
  keyMode: KeyMode; codeHint: string | null; canResendCode: boolean; wrappedDek: string; codeSalt: string; encTitle: string; encBody: string; attachments: AttachmentMeta[];
};

export default function ReceivedMessagePage() {
  const { id } = useParams<{ id: string }>();
  const { refresh } = useAuth();
  const [p, setP] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [opening, setOpening] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ dek: Uint8Array<ArrayBuffer>; title: string; body: JSONContent; attachments: PlainAttachment[] } | null>(null);

  useEffect(() => {
    api<Payload>(`/api/received/${id}`).then(setP, (e) => setError(errorMessage(e)));
  }, [id]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    if (!isWellFormedCode(code)) return setCodeError("Il codice è formato da 20 caratteri, ad esempio K7MQ-2XRT-9DPA-4WNE-H3CV");
    setOpening(true);
    setCodeError(null);
    try {
      const dek = await unwrapRecipientDek(code, p.codeSalt, p.wrappedDek, p.messageId);
      const title = await decryptText(dek, p.encTitle, aad.title(p.messageId));
      const body = JSON.parse(await decryptText(dek, p.encBody, aad.body(p.messageId)));
      const attachments = await decryptAttachmentMetas(dek, p.attachments);
      await api(`/api/received/${id}/event`, { method: "POST", json: { type: "opened" } });
      setOpen({ dek, title, body, attachments });
      refresh();
    } catch {
      const r = await api<{ remaining: number }>(`/api/received/${id}/event`, { method: "POST", json: { type: "code-failed" } }).catch(() => ({ remaining: 0 }));
      setCodeError(r.remaining > 0 ? `Codice non corretto. Tentativi rimasti: ${r.remaining}` : "Troppi tentativi. Per sicurezza riprova domani.");
    } finally {
      setOpening(false);
    }
  }

  async function resend() {
    try {
      await api(`/api/received/${id}/event`, { method: "POST", json: { type: "resend-code" } });
      toast.success("Ti abbiamo inviato di nuovo il codice via email");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!p) return <PageLoader />;

  return (
    <div className="space-y-6">
      <Link href="/app/received" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink print:hidden"><ArrowLeft className="size-4" /> Messaggi ricevuti</Link>
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div key="lock" exit={{ opacity: 0, scale: 0.97 }} className="mx-auto max-w-lg">
            <Card className="text-center">
              <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-brand text-white shadow-xl">
                {p.postMortem ? <HeartHandshake className="size-8" /> : <KeyRound className="size-8" />}
              </div>
              <h1 className="mt-6 font-display text-3xl">Un messaggio da {p.senderName}</h1>
              <p className="mt-2 text-muted">Scritto il {fmtDate(p.writtenAt)}</p>
              {p.postMortem && <p className="mt-4 text-[15px] leading-relaxed text-muted">Ci dispiace per la tua perdita. Prenditi il tempo che ti serve: potrai tornare qui quando vorrai.</p>}
              <form onSubmit={unlock} className="mt-7 space-y-3 text-left">
                <label htmlFor="code" className="block text-sm font-medium">Codice di accesso</label>
                <Input id="code" autoFocus autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" className="h-14 text-center font-mono text-lg tracking-[0.2em]" />
                {codeError && <p className="text-sm text-danger" role="alert">{codeError}</p>}
                <Button type="submit" size="lg" className="w-full" loading={opening}>{opening ? "Sto aprendo il messaggio…" : "Apri il messaggio"}</Button>
              </form>
              {p.keyMode === "SENDER_SHARES_CODE" ? (
                <Notice tone="info" className="mt-5 text-left">
                  {p.senderName} ha scelto di consegnarti il codice personalmente.{p.codeHint && <><br /><em>“{p.codeHint}”</em></>}
                </Notice>
              ) : p.canResendCode ? (
                <button onClick={resend} className="mt-5 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><MailQuestion className="size-4" /> Non trovo il codice, inviamelo di nuovo</button>
              ) : null}
            </Card>
          </motion.div>
        ) : (
          <motion.article key="open" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="space-y-6">
            <Card className="p-7 sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Da {p.senderName} · {fmtDate(p.writtenAt)}</p>
              <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">{open.title}</h1>
              <div className="my-6 h-px bg-line" />
              <RichViewer content={open.body} />
            </Card>
            {open.attachments.length > 0 && (
              <Card>
                <h2 className="mb-4 font-display text-xl">Allegati</h2>
                <AttachmentList dek={open.dek} items={open.attachments} />
              </Card>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Stampa o salva in PDF</Button>
              {p.postMortem && <p className="text-sm text-muted">Se senti il bisogno di parlarne con qualcuno, il Telefono Amico Italia risponde allo 02 2327 2327.</p>}
            </div>
          </motion.article>
        )}
      </AnimatePresence>
    </div>
  );
}
