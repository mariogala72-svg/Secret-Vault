import { Inbox, KeyRound, Mail, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Hai ricevuto un messaggio?" };

const steps = [
  { icon: Mail, t: "Controlla l'email", d: "Ti abbiamo scritto all'indirizzo indicato da chi ti ha lasciato il messaggio, con un link personale." },
  { icon: UserPlus, t: "Accedi o registrati", d: "Usa lo stesso indirizzo email: è così che riconosciamo che il messaggio è per te." },
  { icon: Inbox, t: "Apri “Messaggi ricevuti”", d: "Troverai tutti i messaggi indirizzati a te, anche se hai perso l'email." },
  { icon: KeyRound, t: "Inserisci il codice", d: "Ti è arrivato con l'invito, via SMS, oppure te lo consegnerà di persona chi ha scritto." },
];

export default function ReceivedInfoPage() {
  return (
    <AuthShell title="Hai ricevuto un messaggio?" subtitle="Forse qualcuno ha lasciato qualcosa per te. Ecco come leggerlo.">
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold"><s.icon className="size-5" /></div>
            <div>
              <p className="font-medium">{i + 1}. {s.t}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <ButtonLink href="/register?next=/app/received" className="flex-1">Registrati</ButtonLink>
        <ButtonLink href="/login?next=/app/received" variant="secondary" className="flex-1">Accedi</ButtonLink>
      </div>
    </AuthShell>
  );
}
