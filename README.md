# Secret Vault

> Una cassaforte digitale per le parole che contano: messaggi cifrati, consegnati alla persona giusta, nel momento giusto. Anche quando non ci saremo più.

Questo repository contiene l'**applicazione** (Next.js + Supabase + Resend, deploy su Vercel) e la **progettazione completa** in [`docs/`](docs).

## L'app

**Online:** https://secret-vault-green.vercel.app (Vercel, deploy automatico a ogni push sul branch principale)

| | |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS 4, TipTap, Motion |
| Autenticazione | Integrata nell'app: password Argon2id con pepper, sessioni in cookie HttpOnly, blocco dopo 5 errori, email di verifica e reset inviate con Resend |
| Database | Supabase Postgres, accessibile **solo** dalle API server (driver `postgres`); RLS attiva su tutte le tabelle senza policy, quindi la Data API pubblica non vede nulla |
| Allegati | Cifrati nel browser a blocchi da 512 KB e salvati in Postgres (`bytea`) |
| Email | Resend (template HTML in `src/lib/server/email.ts`) |
| SMS (facoltativo) | Twilio: se configurato, il codice viaggia via SMS separato dal link |
| Scheduler | Vercel Cron giornaliero su `/api/cron` + esecuzione "opportunistica" a ogni accesso degli utenti (al massimo ogni 2 minuti) |
| Crittografia | WebCrypto AES-256-GCM, Argon2id (hash-wasm), ECIES P-256, chiave di recupero BIP-39 (24 parole), timelock drand (tlock-js) |

### Funzionalità
- Registrazione, verifica email, login, reset password, conferma con password per le azioni sensibili.
- **Cassaforte** con seconda password che non lascia mai il dispositivo, chiave di recupero di 24 parole, blocco automatico dopo 10 minuti, limite ai tentativi.
- **Messaggi** con editor ricco, allegati (PDF, Word, JPG, PNG), rubrica cifrata, più destinatari.
- **Consegna**: data speciale (codice sigillato a tempo con drand), invio immediato o manuale, **testamento digitale**.
- **Testamento digitale**: controllo periodico, persone di fiducia con quorum, periodo di ripensamento, annullamento, nessun invio notturno per i messaggi post-mortem.
- **Destinatario**: link personale, registrazione con l'email destinataria, codice di accesso (blocco dopo 5 errori), lettura e download decifrati nel browser, reinvio del codice per 90 giorni.
- Registro attività, eliminazione account con distruzione delle chiavi, tema chiaro/scuro, mobile-first.

### Sviluppo locale
```bash
npm install
cp .env.example .env.local      # compila i valori (o usa gli emulatori, vedi in fondo al file)
# database locale: crea un database Postgres e applica supabase/migrations/*.sql
npm run dev
npm test                        # test della crittografia
```

### Deploy su Vercel
1. Crea un progetto Supabase (regione europea) e applica `supabase/migrations/20261012000000_init.sql`.
2. Imposta su Vercel `DATABASE_URL` (connection string del *Transaction pooler*, porta 6543) oppure collega l'integrazione Supabase di Vercel, che imposta `POSTGRES_URL`.
3. Imposta `SERVER_ENC_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

> `SERVER_ENC_KEY` protegge recapiti e codici custoditi: generala una volta (`openssl rand -base64 32`) e non cambiarla mai in produzione.

### Differenze rispetto alla progettazione (MVP)
- Supabase Postgres senza Redis; lo scheduler usa Vercel Cron (sul piano Hobby è giornaliero: per una precisione al minuto basta un cron esterno che chiami `/api/cron` con `Authorization: Bearer $CRON_SECRET`).
- Per il trigger decesso il codice è custodito con la chiave del server (`SERVER_ENC_KEY`); la suddivisione Shamir con le persone di fiducia è prevista nella v1.
- Lingua: solo italiano per ora (inglese in roadmap).

---

## Riepilogo esecutivo

**Secret Vault** permette a una persona di scrivere messaggi (con allegati) in una cassaforte virtuale protetta da una seconda password, e di programmarne la consegna a uno o più destinatari:

- a una **data fissa** (compleanno, anniversario, matrimonio, la maggiore età di un figlio…);
- **manualmente**, subito o quando lo si decide;
- **al proprio decesso**, rilevato tramite una combinazione di *dead man's switch* (check-in periodico), conferma di **esecutori digitali** fidati e, come segnale ausiliario, **monitoraggio dei necrologi**.

Il destinatario riceve una notifica delicata via email e/o SMS, si registra (o accede), e legge **solo** i messaggi indirizzati a lui inserendo il codice di accesso.

### Punti di forza

| | |
|---|---|
| **Privacy per costruzione** | Cifratura lato client (AES-256-GCM, chiavi derivate con Argon2id). Il server conserva solo dati cifrati: nessun admin, nessun dump del database, nessun ordine del giorno può rivelare il contenuto prima del trigger. |
| **Doppio livello reale** | La password della cassaforte non viene mai inviata al server: non è un "secondo login", è la chiave crittografica stessa. Chi ruba la sessione vede l'elenco dei titoli cifrati, non i contenuti. |
| **Trigger di decesso robusto** | Nessun singolo segnale (un necrologio di un omonimo, un esecutore distratto) può da solo sbloccare i messaggi: serve un quorum, con periodo di contestazione in cui il titolare può annullare. |
| **Consegna affidabile nel lungo periodo** | Il database è la fonte di verità delle consegne (pattern *outbox* + *sweeper*), non una coda in memoria: un messaggio programmato fra 20 anni sopravvive a deploy, migrazioni e cambi di provider. |
| **Tono umano** | Linguaggio, colori e microcopy pensati per temi delicati: lutto, amore, ricordi, segreti. |
| **Conformità** | GDPR e art. 2-terdecies del Codice Privacy italiano (diritti sui dati delle persone decedute) considerati fin dal design. |

### Una scelta onesta da comunicare all'utente

Il brief chiede contemporaneamente che *nessun admin possa leggere i messaggi* e che *il sistema invii automaticamente al destinatario la password per leggerli*. Le due cose sono in tensione: chi spedisce la password, in quel momento, la conosce. Il progetto risolve il conflitto con **tre livelli di consegna** (dettagli in [docs/04-crittografia.md](docs/04-crittografia.md)):

1. **Destinatario già iscritto** → il messaggio è cifrato con la sua chiave pubblica: zero-knowledge pieno, la notifica non contiene segreti.
2. **Codice consegnato dal mittente** (di persona, in una lettera, dal notaio) → zero-knowledge pieno.
3. **Codice custodito e consegnato dal sistema** (default, massima comodità) → il codice è sigillato con *timelock* crittografico (date fisse) o diviso con *Shamir* tra server ed esecutori (decesso): **nessuno può leggerlo prima del trigger**; dopo il trigger il server lo usa una sola volta per la notifica e lo distrugge.

L'interfaccia mostra chiaramente quale livello di protezione si sta scegliendo.

---

## Indice della documentazione

| # | Documento | Contenuto |
|---|---|---|
| 01 | [Specifica funzionale](docs/01-specifica-funzionale.md) | Attori, requisiti funzionali e non funzionali, casi d'uso, regole di business |
| 02 | [Architettura e stack](docs/02-architettura.md) | Diagramma componenti, flusso dati, stack tecnologico motivato, deployment |
| 03 | [Modello dati](docs/03-modello-dati.md) | Entità, relazioni (ER), DDL PostgreSQL, indici, retention |
| 04 | [Crittografia e sicurezza](docs/04-crittografia.md) | Gerarchia delle chiavi, livelli di consegna, threat model, OWASP |
| 05 | [Wireframe](docs/05-wireframe.md) | Schermate principali descritte e schizzate in ASCII, microcopy IT/EN |
| 06 | [Flussi di consegna](docs/06-flussi-consegna.md) | Sequenze temporali step-by-step: data fissa, manuale, decesso, destinatario |
| 07 | [Pseudo-codice](docs/07-pseudocodice.md) | Scheduler, doppia autenticazione, cifratura client, trigger decesso + fallback |
| 08 | [Roadmap, rischi e mitigazioni](docs/08-roadmap-rischi.md) | MVP → v1 → v2, stime, rischi principali |
| 09 | [Considerazioni etiche e legali](docs/09-etica-legale.md) | GDPR, testamento digitale, responsabilità, termini di servizio |
