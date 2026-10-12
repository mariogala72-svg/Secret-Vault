"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Composer, type ComposerInitial } from "@/components/vault/composer";
import { VaultGate } from "@/components/vault/vault-gate";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { openOwnedMessage } from "@/lib/client/messages";
import { useVault } from "@/lib/client/vault";
import type { MessageView } from "@/lib/types";

function Edit() {
  const { id } = useParams<{ id: string }>();
  const { keys } = useVault();
  const [initial, setInitial] = useState<ComposerInitial | null>(null);

  useEffect(() => {
    if (!keys) return;
    api<{ message: MessageView }>(`/api/messages/${id}`)
      .then(async ({ message: m }) => {
        const o = await openOwnedMessage(keys, m);
        setInitial({ id: m.id, dek: o.dek, ownerWrappedDek: m.ownerWrappedDek, title: o.title, body: o.body, attachments: o.attachments, trigger: m.trigger, deliveries: m.deliveries });
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [id, keys]);

  return initial ? <Composer initial={initial} /> : <PageLoader label="Apro il messaggio…" />;
}

export default function EditMessagePage() {
  return (
    <VaultGate>
      <Edit />
    </VaultGate>
  );
}
