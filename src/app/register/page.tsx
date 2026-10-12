"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordStrength, scorePassword } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10 || scorePassword(password) < 2) return setError("Usa almeno 10 caratteri, meglio una frase");
    if (!consent) return setError("Per continuare accetta i Termini e l'Informativa privacy");
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/register", { method: "POST", json: { name: name.trim(), email: email.trim(), password } });
      await refresh();
      router.replace(`/verify-email${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Nome e cognome" hint="È il nome che vedranno i tuoi destinatari.">
        {(id) => <Input id={id} autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Password di accesso" hint="Serve per entrare nel profilo. Per i tuoi messaggi ne creerai un'altra, separata.">
        {(id) => (
          <>
            <PasswordInput id={id} autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrength password={password} />
          </>
        )}
      </Field>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
        <span>
          Accetto i <Link href="/termini" className="text-ink underline underline-offset-2" target="_blank">Termini di servizio</Link> e ho letto l&apos;
          <Link href="/privacy" className="text-ink underline underline-offset-2" target="_blank">Informativa privacy</Link>.
        </span>
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={loading}>Crea il mio account</Button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea il tuo account"
      subtitle="Il primo passo verso la tua cassaforte personale."
      footer={<>Hai già un account? <Link href="/login" className="font-medium text-ink hover:underline">Accedi</Link></>}
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
