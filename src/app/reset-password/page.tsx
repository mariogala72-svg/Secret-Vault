"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordStrength, scorePassword } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, PasswordInput } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/client/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("t") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10 || scorePassword(pw) < 2) return setError("Usa almeno 10 caratteri, meglio una frase");
    if (pw !== pw2) return setError("Le due password non coincidono");
    setLoading(true);
    try {
      await api("/api/auth/reset/confirm", { method: "POST", json: { token, password: pw } });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  if (!token) return <Notice tone="danger">Link non valido. <Link href="/forgot-password" className="underline">Richiedine uno nuovo</Link>.</Notice>;
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Nuova password di accesso">
        {(id) => (
          <>
            <PasswordInput id={id} autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            <PasswordStrength password={pw} />
          </>
        )}
      </Field>
      <Field label="Ripeti la password">{(id) => <PasswordInput id={id} autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />}</Field>
      <Notice tone="info">La password della cassaforte non cambia: i tuoi messaggi restano protetti.</Notice>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>Salva la nuova password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Nuova password" subtitle="Scegli una nuova password per accedere al tuo profilo.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
