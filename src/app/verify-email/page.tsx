"use client";
import { CheckCircle2, MailOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";

const NEXT_KEY = "sv:after-verify";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, loading, refresh, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const justVerified = params.get("verified") === "1";

  // Remember where to go after verification (the link may open in another tab).
  useEffect(() => {
    const n = safeNext(params.get("next"));
    if (n) try { localStorage.setItem(NEXT_KEY, n); } catch {}
  }, [params]);

  useEffect(() => {
    if (!me?.emailVerified) return;
    let target = "/app";
    try {
      target = safeNext(localStorage.getItem(NEXT_KEY)) ?? "/app";
    } catch {}
    router.replace(target);
  }, [me, router]);

  async function check() {
    setChecking(true);
    const m = await refresh();
    if (!m?.emailVerified) toast.info("Non risulta ancora confermata. Controlla anche nella cartella spam.");
    setChecking(false);
  }

  async function resend() {
    setSending(true);
    try {
      await api("/api/auth/verification", { method: "POST" });
      toast.success("Ti abbiamo inviato una nuova email");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!me) {
    return justVerified ? (
      <div className="space-y-5 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-success/15 text-success"><CheckCircle2 className="size-7" /></div>
        <p className="text-lg">Email confermata!</p>
        <ButtonLink href="/login" className="w-full">Accedi</ButtonLink>
      </div>
    ) : (
      <div className="space-y-5">
        {params.get("error") && <Notice tone="danger">Il link non è valido o è scaduto. Accedi per riceverne uno nuovo.</Notice>}
        <ButtonLink href="/login" className="w-full">Accedi</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gold-soft text-gold">
        <MailOpen className="size-7" />
      </div>
      {params.get("error") && <Notice tone="danger">Il link non è valido o è scaduto: richiedine uno nuovo.</Notice>}
      <p className="leading-relaxed text-muted">
        Abbiamo inviato un link di conferma a <strong className="text-ink">{me.email}</strong>. Aprilo per attivare il tuo account, poi torna qui.
      </p>
      <Button className="w-full" size="lg" onClick={check} loading={checking}>Ho confermato la mia email</Button>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={resend} loading={sending}>Invia di nuovo</Button>
        <Button variant="ghost" size="sm" onClick={() => logout("/login")}>Usa un altro account</Button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Conferma la tua email" subtitle="Un ultimo passo per proteggere il tuo account.">
      <Suspense>
        <VerifyInner />
      </Suspense>
    </AuthShell>
  );
}
