"use client";
import { HeartHandshake } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/client/api";

function Inner() {
  const t = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("loading");
    try {
      await api("/api/checkin", { method: "POST", json: { token: t } });
      setState("done");
    } catch (e) {
      setError(errorMessage(e));
      setState("idle");
    }
  }

  return state === "done" ? (
    <div className="space-y-5 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-success/15 text-success"><HeartHandshake className="size-7" /></div>
      <p className="text-lg">Grazie, siamo felici di sentirti. 💛</p>
      <p className="text-muted">Abbiamo registrato il tuo segnale e fermato ogni verifica in corso.</p>
      <ButtonLink href="/app" variant="secondary">Vai al tuo profilo</ButtonLink>
    </div>
  ) : (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-muted">Confermando ci fai sapere che stai bene: il timer del testamento digitale ripartirà e ogni verifica in corso verrà annullata.</p>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button size="lg" className="w-full" onClick={confirm} loading={state === "loading"} disabled={!t}>Sto bene ✓</Button>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <AuthShell title="Sei ancora qui?">
      <Suspense>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
