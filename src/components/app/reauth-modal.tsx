"use client";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useState } from "react";
import { Button } from "../ui/button";
import { Field, PasswordInput } from "../ui/field";
import { Modal } from "../ui/modal";
import { friendlyAuthError } from "@/lib/client/api";
import { clientAuth } from "@/lib/client/firebase";

/** Step-up authentication: sensitive actions require re-entering the login password. */
export function ReauthModal({ open, onClose, onConfirmed, title = "Conferma la tua identità", description, confirmLabel = "Conferma", danger }: {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = clientAuth().currentUser;
    if (!u?.email) return;
    setLoading(true);
    setError(null);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw));
      await u.getIdToken(true);
      await onConfirmed();
      setPw("");
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-5">
        {description && <div className="text-[15px] leading-relaxed text-muted">{description}</div>}
        <Field label="Password di accesso">{(id) => <PasswordInput id={id} autoFocus required value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={loading}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
