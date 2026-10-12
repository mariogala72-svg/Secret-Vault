import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Informativa privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Informativa privacy" updated="12 ottobre 2026">
      <p>Questa è una bozza informativa da completare con i dati del titolare del trattamento e da far revisionare a un consulente privacy prima del lancio pubblico.</p>
      <h2>Cosa non possiamo vedere</h2>
      <p>I testi, i titoli, gli allegati dei messaggi e la tua rubrica vengono <strong>cifrati sul tuo dispositivo</strong> con una chiave derivata dalla password della cassaforte, che non riceviamo mai. Non siamo in grado di leggerli, né di consegnarli a terzi in forma leggibile.</p>
      <h2>Quali dati trattiamo</h2>
      <ul>
        <li><strong>Account</strong>: nome visualizzato, email, data di registrazione (esecuzione del contratto).</li>
        <li><strong>Destinatari e persone di fiducia</strong>: nome ed email (e cellulare, se indicato), conservati cifrati lato server e usati solo per le consegne (legittimo interesse).</li>
        <li><strong>Metadati operativi</strong>: date di programmazione, stato delle consegne, registro delle attività di sicurezza.</li>
      </ul>
      <h2>Fornitori</h2>
      <p>Google Firebase (autenticazione e database), Vercel (hosting), Resend (invio email) ed eventualmente Twilio (SMS), con accordi sul trattamento dei dati.</p>
      <h2>Conservazione e cancellazione</h2>
      <p>Puoi eliminare il tuo account in qualunque momento dalle impostazioni: le chiavi vengono distrutte subito e i dati cancellati. I codici di accesso custoditi per i destinatari vengono eliminati al più tardi 90 giorni dopo la consegna.</p>
      <h2>I tuoi diritti</h2>
      <p>Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15–22 GDPR), e di proporre reclamo al Garante per la protezione dei dati personali.</p>
    </LegalPage>
  );
}
