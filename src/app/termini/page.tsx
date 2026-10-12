import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Termini di servizio" };

export default function TermsPage() {
  return (
    <LegalPage title="Termini di servizio" updated="12 ottobre 2026">
      <p>Bozza da completare e far revisionare da un legale prima del lancio pubblico.</p>
      <h2>Il servizio</h2>
      <p>Secret Vault permette di scrivere messaggi cifrati e programmarne la consegna a persone scelte dall&apos;utente, in una data, su richiesta o al verificarsi della sua scomparsa secondo la procedura descritta nel servizio.</p>
      <h2>Non è un testamento</h2>
      <p>I messaggi <strong>non hanno valore di testamento</strong> ai sensi del codice civile e non possono disporre dei beni dell&apos;utente.</p>
      <h2>Responsabilità dell&apos;utente</h2>
      <ul>
        <li>Custodire la password della cassaforte e la chiave di recupero: senza di esse i contenuti non sono recuperabili.</li>
        <li>Non usare il servizio per contenuti illeciti, molesti o lesivi dei diritti di terzi.</li>
        <li>Mantenere aggiornati i recapiti dei destinatari e delle persone di fiducia.</li>
      </ul>
      <h2>Consegne</h2>
      <p>Ci impegniamo con la massima diligenza a eseguire le consegne, con tentativi ripetuti e notifiche in caso di problemi, ma non possiamo garantire il recapito in caso di indirizzi errati o non più attivi.</p>
    </LegalPage>
  );
}
