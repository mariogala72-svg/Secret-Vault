"use client";
import { CalendarClock, HeartHandshake, Paperclip, Plus, Send, Users, Vault } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { VaultGate } from "@/components/vault/vault-gate";
import { MessageStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { api, errorMessage } from "@/lib/client/api";
import { fmtDate, fmtRelative, triggerLabel } from "@/lib/client/format";
import { openOwnedMessage } from "@/lib/client/messages";
import { useVault } from "@/lib/client/vault";
import type { MessageView } from "@/lib/types";

type Row = MessageView & { title: string };
const FILTERS = [
  { k: "all", label: "Tutti" },
  { k: "draft", label: "Bozze", match: ["DRAFT"] },
  { k: "scheduled", label: "Programmati", match: ["SCHEDULED", "HOLD"] },
  { k: "will", label: "Testamento", match: ["ARMED"] },
  { k: "sent", label: "Consegnati", match: ["DELIVERED", "PARTIAL", "FAILED"] },
];

function List() {
  const { keys } = useVault();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!keys) return;
    api<{ messages: MessageView[] }>("/api/messages")
      .then(async ({ messages }) => {
        const out: Row[] = [];
        for (const m of messages) {
          try {
            const { title } = await openOwnedMessage(keys, { ...m, encBody: undefined, attachments: [] });
            out.push({ ...m, title });
          } catch {
            out.push({ ...m, title: "Messaggio illeggibile" });
          }
        }
        setRows(out);
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [keys]);

  const f = FILTERS.find((x) => x.k === filter)!;
  const shown = rows?.filter((r) => !f.match || f.match.includes(r.status)) ?? null;
  const icon = (r: Row) => (r.trigger.kind === "DEATH" || r.trigger.kind === "DATE_OR_DEATH" ? HeartHandshake : r.trigger.kind.startsWith("MANUAL") ? Send : CalendarClock);

  return (
    <>
      <PageHeader
        eyebrow="Cassaforte"
        title="I tuoi messaggi"
        description="Solo tu puoi leggerli. Ognuno verrà consegnato nel momento che hai scelto."
        actions={
          <>
            <ButtonLink href="/app/contacts" variant="secondary"><Users className="size-4" /> Rubrica</ButtonLink>
            <ButtonLink href="/app/messages/new"><Plus className="size-4" /> Nuovo messaggio</ButtonLink>
          </>
        }
      />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((x) => (
          <button key={x.k} role="tab" aria-selected={filter === x.k} onClick={() => setFilter(x.k)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm transition", filter === x.k ? "bg-ink text-bg" : "bg-surface-2 text-muted hover:text-ink")}>
            {x.label}
            {rows && <span className="ml-1.5 opacity-60">{rows.filter((r) => !x.match || x.match.includes(r.status)).length}</span>}
          </button>
        ))}
      </div>
      {shown === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-3xl" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Vault className="size-6" />}
          title={rows?.length ? "Nessun messaggio in questa sezione" : "La tua cassaforte è vuota"}
          description="C'è qualcosa che vorresti dire a qualcuno? Prenditi il tuo tempo: potrai sempre rileggerlo e modificarlo."
          action={<ButtonLink href="/app/messages/new"><Plus className="size-4" /> Scrivi il primo messaggio</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const Icon = icon(r);
            return (
              <li key={r.id}>
                <Link href={`/app/messages/${r.id}`} className="glass group flex items-center gap-4 rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-line-strong sm:p-5">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-gold/20 text-accent"><Icon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-lg">{r.title}</p>
                      <MessageStatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {triggerLabel(r.trigger)}
                      {r.trigger.fireAt && ["SCHEDULED", "ARMED"].includes(r.status) && ` · ${fmtRelative(r.trigger.fireAt)}`}
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-xs text-faint">
                      <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {r.deliveries.map((d) => d.name).join(", ") || "Nessun destinatario"}</span>
                      {r.attachments.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" /> {r.attachments.length}</span>}
                      <span className="hidden sm:inline">Modificato il {fmtDate(r.updatedAt)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <VaultGate>
      <List />
    </VaultGate>
  );
}
