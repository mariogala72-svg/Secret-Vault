"use client";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, CalendarClock, KeyRound, Pencil, RotateCcw, Send, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AttachmentList, type PlainAttachment } from "@/components/vault/attachment-list";
import { RichViewer } from "@/components/vault/rich-editor";
import { VaultGate } from "@/components/vault/vault-gate";
import { DeliveryStatusBadge, MessageStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { fmtDate, fmtRelative, triggerLabel } from "@/lib/client/format";
import { openOwnedMessage } from "@/lib/client/messages";
import { useVault } from "@/lib/client/vault";
import type { KeyMode, MessageView } from "@/lib/types";

const KEY_MODE: Record<KeyMode, string> = {
  SENDER_SHARES_CODE: "Codice consegnato da te",
  ESCROW_TLOCK: "Codice sigillato a tempo",
  ESCROW_SERVER: "Codice custodito da Secret Vault",
};

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { keys } = useVault();
  const { refresh } = useAuth();
  const [m, setM] = useState<MessageView | null>(null);
  const [plain, setPlain] = useState<{ dek: Uint8Array<ArrayBuffer>; title: string; body: JSONContent | null; attachments: PlainAttachment[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!keys) return;
    api<{ message: MessageView }>(`/api/messages/${id}`)
      .then(async ({ message }) => {
        const opened = await openOwnedMessage(keys, message);
        setM(message);
        setPlain(opened);
      })
      .catch((e) => {
        toast.error(errorMessage(e));
        router.replace("/app/messages");
      });
  }, [id, keys, router, version]);

  async function action(kind: "send" | "cancel" | "delete") {
    const confirmText = {
      send: "Inviare ora il messaggio a tutti i destinatari?",
      cancel: "Annullare la programmazione? Il messaggio tornerà tra le bozze e non verrà inviato.",
      delete: "Eliminare definitivamente il messaggio? Non sarà più possibile recuperarlo.",
    }[kind];
    if (!confirm(confirmText)) return;
    setBusy(kind);
    try {
      if (kind === "delete") {
        await api(`/api/messages/${id}`, { method: "DELETE" });
        await refresh();
        toast.success("Messaggio eliminato");
        return router.replace("/app/messages");
      }
      await api(`/api/messages/${id}/${kind}`, { method: "POST" });
      toast.success(kind === "send" ? "Messaggio inviato 💌" : "Programmazione annullata");
      load();
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!m || !plain) return <PageLoader label="Apro il messaggio…" />;
  const editable = ["DRAFT", "SCHEDULED", "ARMED", "HOLD"].includes(m.status) && !m.deliveries.some((d) => ["SENDING", "SENT", "OPENED"].includes(d.status));
  const tlocked = m.deliveries.some((d) => d.keyMode === "ESCROW_TLOCK");

  return (
    <div className="space-y-6">
      <Link href="/app/messages" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Tutti i messaggi</Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <MessageStatusBadge status={m.status} />
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">{plain.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-muted">
            <CalendarClock className="size-4" /> {triggerLabel(m.trigger)}
            {m.trigger.fireAt && ["SCHEDULED", "ARMED"].includes(m.status) && <span className="text-faint">· {fmtRelative(m.trigger.fireAt)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <ButtonLink href={`/app/messages/${id}/edit`} variant="secondary"><Pencil className="size-4" /> Modifica</ButtonLink>}
          {["HOLD", "SCHEDULED"].includes(m.status) && !tlocked && (
            <Button onClick={() => action("send")} loading={busy === "send"}><Send className="size-4" /> Invia ora</Button>
          )}
          {["SCHEDULED", "ARMED", "HOLD"].includes(m.status) && editable && (
            <Button variant="ghost" onClick={() => action("cancel")} loading={busy === "cancel"}><RotateCcw className="size-4" /> Annulla</Button>
          )}
          <Button variant="danger" onClick={() => action("delete")} loading={busy === "delete"} aria-label="Elimina"><Trash2 className="size-4" /></Button>
        </div>
      </div>

      {tlocked && m.status === "SCHEDULED" && (
        <Notice tone="info" icon={<Timer className="size-4 text-accent" />}>
          Il codice di accesso è sigillato con la rete drand fino al {fmtDate(m.trigger.fireAt, true)}: nessuno, nemmeno noi, può aprirlo prima. Per questo non è possibile anticipare l&apos;invio.
        </Notice>
      )}

      <Card className="p-6 sm:p-10">
        {plain.body ? <RichViewer content={plain.body} /> : <p className="text-muted">Il messaggio è vuoto.</p>}
        <p className="mt-8 border-t border-line pt-4 text-sm text-faint">Scritto il {fmtDate(m.createdAt)}</p>
      </Card>

      {plain.attachments.length > 0 && (
        <Card>
          <h2 className="mb-4 font-display text-xl">Allegati</h2>
          <AttachmentList dek={plain.dek} items={plain.attachments} />
        </Card>
      )}

      <Card>
        <h2 className="font-display text-xl">Destinatari</h2>
        {m.deliveries.length === 0 ? (
          <p className="mt-3 text-muted">Nessun destinatario ancora.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {m.deliveries.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.name} <span className="text-sm font-normal text-muted">· {d.emailMasked}</span></p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><KeyRound className="size-3.5" /> {KEY_MODE[d.keyMode]}</p>
                  {d.lastError && d.status !== "SENT" && d.status !== "OPENED" && <p className="mt-1 text-xs text-danger">Ultimo tentativo non riuscito, riproveremo automaticamente.</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  {d.openedAt ? <span>Letto il {fmtDate(d.openedAt)}</span> : d.sentAt ? <span>Inviato il {fmtDate(d.sentAt)}</span> : null}
                  <DeliveryStatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function MessagePage() {
  return (
    <VaultGate>
      <Detail />
    </VaultGate>
  );
}
