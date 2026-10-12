"use client";
import { HeartHandshake, Mail } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";

export default function DeliveryLanding() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, me, loading } = useAuth();
  const [info, setInfo] = useState<{ senderName: string; emailMasked: string; postMortem: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ senderName: string; emailMasked: string; postMortem: boolean }>(`/api/received/lookup?token=${encodeURIComponent(token)}`).then(setInfo, (e) => setError(errorMessage(e)));
  }, [token]);

  useEffect(() => {
    if (loading || !user || !me?.emailVerified || !info) return;
    api<{ deliveryId: string }>("/api/received/claim", { method: "POST", json: { token } }).then(
      (r) => router.replace(`/app/received/${r.deliveryId}`),
      (e) => setError(errorMessage(e)),
    );
  }, [loading, user, me?.emailVerified, info, token, router]);

  const next = encodeURIComponent(`/r/${token}`);
  if (!info && !error) return <PageLoader />;

  return (
    <AuthShell title={info ? "C'è un messaggio per te" : "Link non valido"}>
      {error ? (
        <Notice tone="danger">{error}</Notice>
      ) : info && (!user || !me?.emailVerified) ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-brand text-white shadow-xl">
            {info.postMortem ? <HeartHandshake className="size-8" /> : <Mail className="size-8" />}
          </div>
          <p className="text-lg leading-relaxed">
            <strong>{info.senderName}</strong> {info.postMortem ? "ha voluto lasciarti un messaggio." : "ha scritto qualcosa per te."}
          </p>
          <p className="text-[15px] leading-relaxed text-muted">
            Per proteggerlo, accedi o crea un account gratuito con l&apos;indirizzo a cui hai ricevuto l&apos;invito (<span className="font-mono">{info.emailMasked}</span>).
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={`/register?next=${next}`} className="flex-1">Crea un account</ButtonLink>
            <ButtonLink href={`/login?next=${next}`} variant="secondary" className="flex-1">Accedi</ButtonLink>
          </div>
          <p className="text-xs text-faint">Vedrai solo ciò che è stato scritto per te, nient&apos;altro.</p>
        </div>
      ) : (
        <PageLoader label="Apro il messaggio…" />
      )}
    </AuthShell>
  );
}
