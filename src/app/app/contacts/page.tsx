"use client";
import { Mail, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ContactModal } from "@/components/vault/contact-form";
import { VaultGate } from "@/components/vault/vault-gate";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { deleteContact, loadContacts, type Contact } from "@/lib/client/contacts";
import { useVault } from "@/lib/client/vault";

function Contacts() {
  const { user, me } = useAuth();
  const { keys } = useVault();
  const [list, setList] = useState<Contact[] | null>(null);
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);

  useEffect(() => {
    if (keys && user) loadContacts(keys, user.uid).then(setList, (e) => toast.error(errorMessage(e)));
  }, [keys, user]);

  async function remove(c: Contact) {
    if (!confirm(`Rimuovere ${c.name} dalla rubrica? I messaggi già programmati non cambieranno.`)) return;
    await deleteContact(c.id);
    setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Rubrica"
        title="Le tue persone"
        description="Nomi e recapiti sono cifrati nella tua cassaforte."
        actions={<Button onClick={() => setEditing(null)}><Plus className="size-4" /> Aggiungi</Button>}
      />
      {list === null ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-3xl" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="Ancora nessuno" description="Aggiungi le persone a cui vuoi lasciare un messaggio." action={<Button onClick={() => setEditing(null)}><Plus className="size-4" /> Aggiungi una persona</Button>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className="glass flex items-center gap-4 rounded-3xl p-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft font-display text-lg text-gold">{c.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name} {c.relation && <span className="font-normal text-muted">· {c.relation}</span>}</p>
                <p className="flex items-center gap-1.5 truncate text-sm text-muted"><Mail className="size-3.5 shrink-0" /> {c.email}</p>
                {c.phone && <p className="flex items-center gap-1.5 truncate text-sm text-muted"><Phone className="size-3.5 shrink-0" /> {c.phone}</p>}
              </div>
              <button onClick={() => setEditing(c)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Modifica ${c.name}`}><Pencil className="size-4" /></button>
              <button onClick={() => remove(c)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Rimuovi ${c.name}`}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined && (
        <ContactModal
          open
          initial={editing}
          smsEnabled={me?.smsEnabled}
          onClose={() => setEditing(undefined)}
          onSaved={(c) => setList((l) => [...(l ?? []).filter((x) => x.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name, "it")))}
        />
      )}
    </>
  );
}

export default function ContactsPage() {
  return (
    <VaultGate>
      <Contacts />
    </VaultGate>
  );
}
