"use client";
import { useState } from "react";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { Modal } from "../ui/modal";
import { errorMessage } from "@/lib/client/api";
import { saveContact, type Contact } from "@/lib/client/contacts";
import { newId } from "@/lib/client/format";
import { useAuth } from "@/lib/client/auth";
import { useVault } from "@/lib/client/vault";

export function ContactModal({ open, onClose, initial, onSaved, smsEnabled }: { open: boolean; onClose: () => void; initial?: Contact | null; onSaved: (c: Contact) => void; smsEnabled?: boolean }) {
  const { user } = useAuth();
  const { keys } = useVault();
  const [c, setC] = useState<Contact>(initial ?? { id: "", name: "", email: "", relation: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!keys || !user) return;
    const phone = c.phone?.replace(/[\s.-]/g, "") || "";
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) return setError("Inserisci il cellulare con il prefisso internazionale, es. +39 333 1234567");
    setLoading(true);
    try {
      const contact = { ...c, id: c.id || newId(), name: c.name.trim(), email: c.email.trim().toLowerCase(), phone: phone || undefined };
      await saveContact(keys, user.uid, contact, !c.id);
      onSaved(contact);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={c.id ? "Modifica persona" : "Aggiungi una persona"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome">{(id) => <Input id={id} required maxLength={100} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Es. Tommaso" />}</Field>
        <Field label="Relazione (facoltativa)">{(id) => <Input id={id} maxLength={60} value={c.relation ?? ""} onChange={(e) => setC({ ...c, relation: e.target.value })} placeholder="Es. figlio, amica, sorella" />}</Field>
        <Field label="Email" hint="Riceverà qui l'invito a leggere il messaggio.">
          {(id) => <Input id={id} type="email" required value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />}
        </Field>
        <Field label="Cellulare (facoltativo)" hint={smsEnabled ? "Se presente, il codice di accesso arriverà via SMS, separato dal link." : "Utile per il futuro invio del codice via SMS."}>
          {(id) => <Input id={id} type="tel" value={c.phone ?? ""} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="+39 333 1234567" />}
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" loading={loading}>Salva</Button>
        </div>
      </form>
    </Modal>
  );
}
