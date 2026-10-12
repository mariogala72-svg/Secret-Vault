"use client";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell, NotConfigured } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { friendlyAuthError } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { clientAuth } from "@/lib/client/firebase";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/app";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { configured, user, me, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("verified") === "1") toast.success("Email confermata! Ora puoi accedere.");
  }, [params]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await user.reload();
      if (user.emailVerified) {
        await user.getIdToken(true);
        await refresh();
        router.replace(next);
      } else router.replace(`/verify-email?next=${encodeURIComponent(next)}`);
    })();
  }, [user, me?.emailVerified, next, refresh, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(clientAuth(), email.trim(), password);
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  if (!configured) return <NotConfigured />;
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Password di accesso">
        {(id) => <PasswordInput id={id} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={loading}>Accedi</Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-muted underline-offset-4 hover:text-ink hover:underline">Password dimenticata?</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Bentornato"
      subtitle="Accedi al tuo profilo. La cassaforte resterà chiusa finché non inserirai la sua password."
      footer={<>Non hai un account? <Link href="/register" className="font-medium text-ink hover:underline">Registrati</Link></>}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
