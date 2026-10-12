"use client";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/client/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/reset", { method: "POST", json: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Password dimenticata" subtitle="Ti invieremo un link per scegliere una nuova password di accesso." footer={<Link href="/login" className="hover:text-ink">← Torna all&apos;accesso</Link>}>
      {sent ? (
        <Notice tone="success" icon={<MailCheck className="size-5 text-success" />}>
          Se esiste un account con questo indirizzo, riceverai a breve un&apos;email con le istruzioni.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">{(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Notice tone="info">La password della cassaforte <strong>non</strong> si può reimpostare via email: per quella serve la tua chiave di recupero.</Notice>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>Invia il link</Button>
        </form>
      )}
    </AuthShell>
  );
}
