"use client";
import { Inbox, MailOpen, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/client/api";
import { fmtDate } from "@/lib/client/format";

type Item = { id: string; senderName: string; sentAt: string | null; openedAt: string | null };

export default function ReceivedPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    api<{ items: Item[] }>("/api/received").then((r) => setItems(r.items), (e) => toast.error(errorMessage(e)));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Per te" title="Messaggi ricevuti" description="Qui trovi i messaggi che qualcuno ha scritto per te. Vedrai solo ciò che è stato scritto per te." />
      {items === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-24 rounded-3xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="Nessun messaggio, per ora" description="Quando qualcuno ti lascerà un messaggio riceverai un'email, e lo troverai anche qui." />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/app/received/${i.id}`} className="glass flex items-center gap-4 rounded-3xl p-5 transition hover:-translate-y-0.5">
                <div className={`grid size-12 place-items-center rounded-2xl ${i.openedAt ? "bg-surface-2 text-muted" : "bg-gradient-brand text-white"}`}>{i.openedAt ? <MailOpen className="size-5" /> : <Mail className="size-5" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg">Da {i.senderName}</p>
                  <p className="text-sm text-muted">Arrivato il {fmtDate(i.sentAt)}</p>
                </div>
                {!i.openedAt && <Badge tone="accent">Nuovo</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
