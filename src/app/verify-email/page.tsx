"use client";
import { MailOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/app";
  const { user, loading, refresh, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function check() {
    if (!user) return;
    setChecking(true);
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true);
      await refresh();
      router.replace(next);
    } else {
      toast.info("Non risulta ancora confermata. Controlla anche nella cartella spam.");
      setChecking(false);
    }
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

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gold-soft text-gold">
        <MailOpen className="size-7" />
      </div>
      <p className="leading-relaxed text-muted">
        Abbiamo inviato un link di conferma a <strong className="text-ink">{user?.email}</strong>. Aprilo per attivare il tuo account, poi torna qui.
      </p>
      <Button className="w-full" size="lg" onClick={check} loading={checking}>Ho confermato la mia email</Button>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={resend} loading={sending}>Invia di nuovo</Button>
        <Button variant="ghost" size="sm" onClick={() => logout().then(() => router.replace("/login"))}>Usa un altro account</Button>
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
