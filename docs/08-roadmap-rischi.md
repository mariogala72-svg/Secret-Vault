# 08 — Roadmap, rischi e mitigazioni

## 1. Roadmap

Stime indicative per un team di **2 full-stack + 1 designer part-time + consulenza security/legale**.

### Fase 0 — Fondamenta (3 settimane)
- Monorepo, CI/CD, ambienti, IaC, osservabilità di base.
- Pacchetto `crypto` con formati busta v1, **test vector** e test di proprietà (fuzzing round-trip).
- DPIA preliminare, scelta del nome a dominio e configurazione SPF/DKIM/DMARC.
- Design system (token, componenti accessibili, tema chiaro/scuro), copy guide IT/EN.

### Fase 1 — MVP (10–12 settimane) · *"Una lettera nel futuro"*
Obiettivo: validare il valore con utenti reali sui messaggi a **data fissa** e **manuali**.
- Registrazione, verifica email, login, reset password, sessioni server-side.
- Cassaforte: creazione, chiave di recupero, sblocco, blocco automatico.
- Messaggi: editor TipTap, allegati PDF/JPG/PNG/DOCX cifrati, bozze, stati.
- Destinatari email + SMS; livelli **L2** e **L3-timelock**.
- Trigger data fissa e manuale; sweeper + release + notification worker con retry e failover email.
- Esperienza destinatario completa (registrazione, codice, lettura, download).
- Ricerca fallback "Ci sono messaggi per me?".
- IT/EN, WCAG AA, GDPR base (consensi, cancellazione con crypto-shredding).
- Pen test esterno sul perimetro auth/crypto prima del beta pubblico.

**Criteri di uscita**: 0 consegne perse in 30 gg di beta; p95 sweeper lag < 2 min; SUS ≥ 75 nei test di usabilità (inclusi utenti 60+).

### Fase 2 — v1 (10–12 settimane) · *"Testamento digitale"*
- Dead man's switch con solleciti multicanale e "pausa ricovero/viaggio".
- Esecutori digitali, quorum, Shamir (**L3-Shamir**), periodo di contestazione, pannello esecutore.
- Trigger decesso e "data oppure decesso".
- 2FA TOTP + passkey, step-up, gestione sessioni/dispositivi, avvisi nuovi accessi.
- Consegna diretta **L1** e ri-sigillatura dopo la prima apertura.
- Audit log consultabile dal titolare; esportazione dati con tool offline open source.
- Failover SMS (Vonage), promemoria pre-invio, anteprima destinatario.
- Bug bounty, secondo pen test, audit crittografico indipendente del Crypto Engine.
- Piano di continuità del servizio formalizzato (vedi 09 §6).

### Fase 3 — v2 (continua) · *"Memoria viva"*
- Monitoraggio necrologi tramite partnership con onoranze funebri/aggregatori; caricamento certificato di morte con verifica a doppia approvazione.
- Messaggi audio/video (cifratura a stream), messaggi ricorrenti.
- App mobile companion (React Native/Expo) con push e passkey native; codice firmato come garanzia aggiuntiva contro JS malevolo.
- Ibrido post-quantum (X25519 + ML-KEM-768) per le chiavi a lungo termine.
- Temporal per i workflow lunghi del caso decesso.
- Piani a pagamento (spazio, numero destinatari, durata conservazione), B2B con notai/onoranze.
- Ulteriori lingue (ES, FR, DE).

## 2. Rischi e mitigazioni

| # | Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|---|
| R1 | **Rilascio prematuro** di messaggi post-mortem (falso positivo: omonimo, coma, esecutore malevolo) | Media | **Critico** | Nessun segnale singolo sblocca; quorum umano; contestazione ≥ 24 h con contatti ripetuti; "pausa ricovero"; esecutori istruiti; quiet hours; audit. |
| R2 | **Mancata consegna** (bug, provider, recapiti obsoleti dopo anni) | Media | Critico | DB come fonte di verità, outbox, idempotenza, multi-provider, retry/cambio canale, escalation; verifica annuale dei recapiti chiedendo al titolare; monitor sweeper lag; test end-to-end sintetici giornalieri ("canary message") in produzione. |
| R3 | **Perdita della password della cassaforte** | Alta | Alto (dati irrecuperabili) | Chiave di recupero obbligatoria con verifica; promemoria periodico "sai ancora dov'è la tua chiave di recupero?"; messaggi già programmati L3 si consegnano comunque (non serve la password del titolare). |
| R4 | **Cessazione dell'azienda** prima della consegna | Media (orizzonte decennale) | Critico | Piano di continuità: fondo di garanzia, accordo di subentro con un terzo (notaio/fondazione), export "busta sigillata" degli escrow, codice dei formati open source, preavviso agli utenti. |
| R5 | Compromissione server / JS malevolo servito al client | Bassa | Critico | CSP, SRI, build riproducibili, hash pubblicati, audit, separazione release key in KMS, minimi privilegi; v2: app firmata. |
| R6 | Phishing che imita le notifiche | Alta | Alto | DMARC reject, BIMI, notifiche che non chiedono mai credenziali, pagina pubblica di verifica, link a dominio unico, codice su canale separato. |
| R7 | Abuso: messaggi di molestia/minaccia programmati | Media | Alto | Il contenuto non è leggibile da noi → canale di segnalazione per i destinatari, blocco del mittente per quel destinatario, limiti di invio per account nuovi, verifica telefono per invii SMS, cooperazione con autorità sui metadati. |
| R8 | Dipendenza da drand (timelock) | Bassa | Medio | drand è una rete distribuita (League of Entropy); in caso di indisponibilità prolungata il Release Worker ritenta; busta di emergenza alternativa cifrata con KMS valutabile (riduce la garanzia: scelta da documentare). |
| R9 | Costi SMS e deliverability internazionale | Media | Medio | Preferire email; SMS solo per codice; sender ID registrato; quote per piano. |
| R10 | Impatto emotivo negativo sul destinatario | Media | Alto | Copy validato con psicologo del lutto, quiet hours, possibilità di rimandare la lettura, risorse di supporto, nessuna gamification. |
| R11 | Obsolescenza crittografica su orizzonti di 20+ anni | Media | Alto | `crypto_version`, migrazione trasparente al successivo sblocco del titolare; PQ ibrido in v2. |
| R12 | Rischio legale (contenuti con valore testamentario, contenziosi tra eredi) | Media | Alto | ToS chiari (non è un testamento legale), limitazione di responsabilità nei limiti di legge, consulenza legale, log di audit come prova della corretta esecuzione. |
| R13 | Fonti necrologi: scraping vietato o dati inaffidabili | Alta | Medio | Solo partnership/licenze; segnale ausiliario, mai decisivo; funzionalità opt-in in v2. |
