# 02 — Architettura e stack

## 1. Principi architetturali

1. **Zero-knowledge by default.** Tutto ciò che è contenuto (testo, titoli, allegati, rubrica) viene cifrato nel browser. Il backend è un "custode di buste chiuse".
2. **Il database è la fonte di verità del tempo.** Le consegne future vivono in tabelle PostgreSQL, non in code volatili. Redis/BullMQ serve solo per l'esecuzione a breve termine.
3. **Separazione dei poteri.** Il servizio che rilascia i messaggi (Release Worker) è un processo distinto, con credenziali proprie e unico autorizzato a usare la chiave KMS di rilascio.
4. **Fail-safe, non fail-open.** In caso di dubbio (segnali contrastanti, errori di verifica) il sistema **non** consegna e chiede conferma umana.
5. **Monolite modulare prima, microservizi poi.** Un backend NestJS con moduli ben separati, deployabile come API + worker distinti dallo stesso codebase.

## 2. Diagramma logico dei componenti

```mermaid
flowchart LR
    subgraph Client["Browser / PWA"]
        UI[Next.js UI<br/>React + Tailwind]
        CRYPTO[Crypto Engine<br/>WebCrypto + libsodium.js<br/>Argon2id WASM]
        UI <--> CRYPTO
    end

    subgraph Edge["Edge"]
        CDN[CDN + WAF<br/>Cloudflare / Vercel]
    end

    subgraph Backend["Backend (NestJS, container)"]
        API[API Gateway<br/>REST + Zod/class-validator]
        AUTH[Auth Module<br/>sessioni, 2FA, WebAuthn]
        VAULT[Vault Module<br/>blob cifrati, chiavi wrappate]
        MSG[Message Module<br/>stati, destinatari, trigger]
        TRUST[Trust Module<br/>esecutori, dead man's switch]
        AUDIT[Audit Module<br/>log append-only]
    end

    subgraph Workers["Worker (stesso codebase, processi separati)"]
        SWEEP[Scheduler Sweeper<br/>ogni 60 s]
        REL[Release Worker<br/>accesso KMS release key]
        NOTIF[Notification Worker<br/>email / SMS / push]
        OBIT[Obituary Watcher<br/>fonti necrologi]
        DMS[Dead-Man Switch Worker<br/>check-in e solleciti]
    end

    subgraph Data["Dati"]
        PG[(PostgreSQL 16<br/>dati + outbox)]
        REDIS[(Redis<br/>BullMQ, rate limit)]
        S3[(Object Storage<br/>S3 / R2<br/>allegati cifrati)]
        KMS[[KMS / HSM<br/>release key, DB key]]
    end

    subgraph External["Servizi esterni"]
        EMAIL[Resend / SES]
        SMS[Twilio]
        DRAND[drand<br/>timelock beacon]
        OBITSRC[Fonti necrologi<br/>partner onoranze / portali]
    end

    UI --> CDN --> API
    CRYPTO -- upload diretto<br/>URL prefirmati --> S3
    API --> AUTH & VAULT & MSG & TRUST
    AUTH & VAULT & MSG & TRUST --> AUDIT
    AUTH & VAULT & MSG & TRUST & AUDIT --> PG
    AUTH --> REDIS
    SWEEP --> PG
    SWEEP --> REDIS
    REDIS --> REL & NOTIF
    REL --> KMS
    REL --> DRAND
    REL --> PG
    NOTIF --> EMAIL & SMS
    NOTIF --> PG
    OBIT --> OBITSRC
    OBIT --> PG
    DMS --> PG
    DMS --> REDIS
```

## 3. Flusso dati principale

### 3.1 Scrittura di un messaggio

```mermaid
sequenceDiagram
    autonumber
    actor T as Titolare
    participant B as Browser (Crypto Engine)
    participant A as API
    participant S as Object Storage
    participant D as PostgreSQL

    T->>B: Sblocca cassaforte (password cassaforte)
    B->>A: GET /vault/keys
    A->>D: legge salt + private key cifrata
    A-->>B: {kdf_salt, kdf_params, enc_private_key}
    B->>B: KEK = Argon2id(pwd, salt)<br/>privKey = AES-GCM-decrypt(KEK, enc_private_key)
    T->>B: Scrive testo + allega file
    B->>B: DEK = random 256 bit<br/>cifra corpo, titolo, file (AES-256-GCM, a chunk)
    B->>A: POST /attachments/upload-url (dimensione, n° chunk)
    A-->>B: URL prefirmati
    B->>S: PUT chunk cifrati
    B->>B: wrap DEK con chiave pubblica titolare<br/>+ wrap per ogni destinatario (livello 1/2/3)
    B->>A: POST /messages {ciphertexts, wrapped_keys, trigger, recipients}
    A->>D: INSERT in transazione + delivery pianificate + audit
    A-->>B: 201 Created
```

### 3.2 Esecuzione di un trigger (vista d'insieme)

```
[PostgreSQL: delivery.due_at <= now() AND status='PENDING']
        │  Sweeper (ogni 60 s, SELECT … FOR UPDATE SKIP LOCKED)
        ▼
[delivery.status = 'QUEUED'] ──► BullMQ "release" (jobId = delivery_id → idempotente)
        │  Release Worker
        ▼
 apre il sigillo del codice (timelock drand / Shamir+KMS) se livello 3
 genera notifica dal template, salva in outbox
        │
        ▼
 BullMQ "notify" ──► Notification Worker ──► Resend / Twilio
        │                                     │
        ▼                                     ▼
 delivery_attempt (esito, provider_id)   webhook provider (delivered/bounced)
        │
        ▼
 delivery.status = 'SENT' → 'OPENED' alla prima lettura
 distruzione del codice in chiaro (memoria) e dello share rilasciato
```

Dettagli temporali in [06-flussi-consegna.md](06-flussi-consegna.md).

## 4. Stack tecnologico

| Livello | Scelta | Motivazione | Alternative valutate |
|---|---|---|---|
| Frontend | **Next.js 15 (App Router) + React 19 + TypeScript** | SSR per pagine pubbliche/SEO, RSC per shell, componenti client per la cassaforte | Remix, SvelteKit |
| Styling | **TailwindCSS 4 + Radix UI / shadcn/ui** | Componenti accessibili (focus, ARIA) pronti; tema scuro/chiaro con CSS variables | Chakra UI |
| Editor | **TipTap (ProseMirror)** | Estensioni controllate (solo marcatori consentiti), output JSON → nessun HTML arbitrario | Lexical, Quill |
| Sanitizzazione | **DOMPurify** al rendering | Il contenuto è decifrato nel client: il server non può sanitizzarlo | — |
| Crittografia client | **WebCrypto** (AES-GCM, HKDF) + **libsodium.js** (X25519, sealed box, secretstream) + **argon2-browser / hash-wasm** (Argon2id) | Primitive standard, auditate; niente crittografia "fatta in casa" | tweetnacl |
| Timelock | **tlock-js (drand quicknet)** | Cifratura verso un round futuro: indecifrabile da chiunque prima della data | — |
| Segreti condivisi | **Shamir's Secret Sharing** (es. `shamir-secret-sharing` di Privy, auditata) | Split del codice tra server ed esecutori | — |
| i18n | **next-intl** (ICU) | Pluralizzazione, date, routing per locale | i18next |
| Backend | **NestJS (Node 22, TypeScript)** | Moduli, DI, guard per autorizzazioni, ecosistema maturo; stesso linguaggio del client per i formati crypto | FastAPI, Django |
| ORM | **Prisma** (o Drizzle) + SQL raw per lo sweeper | Migrazioni versionate; `SKIP LOCKED` in SQL esplicito | TypeORM |
| Database | **PostgreSQL 16** (gestito, es. Neon/RDS/Supabase in UE) | Transazioni, `SKIP LOCKED`, JSONB, RLS come difesa in profondità | — |
| Code | **Redis 7 + BullMQ** | Retry, backoff, rate limit per provider, dashboard | Temporal (valutato per v2: workflow lunghi del trigger decesso) |
| Storage | **Cloudflare R2** o **S3** (eu) con SSE + versioning | Allegati già cifrati lato client; SSE come secondo strato | — |
| KMS | **AWS KMS / GCP Cloud KMS** (HSM-backed) | Chiave di rilascio non esportabile; policy IAM per il solo Release Worker; audit CloudTrail | HashiCorp Vault |
| Auth | **Implementazione propria** su librerie standard (`@node-rs/argon2`, `otplib`, `@simplewebauthn/server`), sessioni in PostgreSQL/Redis | La cassaforte richiede comunque crypto custom; evita di affidare l'identità di un servizio così sensibile a terzi; nessun lock-in per un servizio pensato per decenni | Auth.js, Clerk, Auth0 (accettabili per MVP rapido: solo login, mai la cassaforte) |
| Email | **Resend** (primario) + **Amazon SES** (failover) | API semplice, template React Email; failover per affidabilità | SendGrid, Mailgun |
| SMS | **Twilio** (primario) + **Vonage** (failover) | Copertura, sender ID alfanumerico registrato | MessageBird |
| Push (v2) | Web Push (VAPID) / Expo per app companion | — | — |
| Hosting | **Vercel** (frontend, region `fra1`) + **Railway / Render / AWS ECS** (API e worker, region UE) | Separazione statico/dinamico; worker long-running fuori da serverless | Fly.io |
| Osservabilità | OpenTelemetry → Grafana / Datadog; **Sentry** con scrubbing | Metriche su sweeper lag, tasso di consegna, retry | — |
| CI/CD | GitHub Actions: lint, typecheck, test, SAST (CodeQL, Semgrep), SCA (Dependabot/Renovate), secret scanning, build firmata | — | — |

## 5. Struttura del repository (prevista)

```
secret-vault/
├── apps/
│   ├── web/                 # Next.js (UI, i18n, crypto engine client)
│   └── api/                 # NestJS (API + worker entrypoint)
│       └── src/
│           ├── auth/  vault/  messages/  recipients/
│           ├── trust/       # esecutori, dead man's switch, necrologi
│           ├── delivery/    # sweeper, release, notification
│           ├── audit/  gdpr/  common/
│           └── main.api.ts | main.worker.ts
├── packages/
│   ├── crypto/              # formati busta, versioning, test vector (condiviso web/api/tool offline)
│   ├── shared/              # tipi DTO, schemi Zod, costanti
│   ├── email-templates/     # React Email, IT/EN
│   └── ui/                  # design system
├── tools/
│   └── vault-export-reader/ # CLI open source per decifrare l'export offline
├── docs/
└── infra/                   # Terraform / IaC
```

## 6. Deployment

```mermaid
flowchart TB
    U((Utenti)) --> CF[Cloudflare<br/>DNS, WAF, rate limit, bot mgmt]
    CF --> V[Vercel fra1<br/>Next.js]
    CF --> LB[Load balancer]
    LB --> API1[API pod]
    LB --> API2[API pod]
    subgraph Private["Rete privata (eu-central)"]
        API1 & API2 --> PG[(PostgreSQL primario<br/>+ replica + PITR)]
        API1 & API2 --> R[(Redis HA)]
        W1[Sweeper x2<br/>leader-free, SKIP LOCKED] --> PG
        W2[Release Worker x2] --> KMS[[KMS]]
        W3[Notification Worker xN]
        W1 & W2 & W3 --> R
    end
    PG -. backup cifrati .-> BK[(Bucket backup<br/>altra region UE, Object Lock)]
```

- **Ambienti**: `dev`, `staging` (dati sintetici, provider in sandbox), `prod`.
- **Segreti**: in Secret Manager, mai in repository; rotazione trimestrale.
- **Backup**: PITR + snapshot giornalieri cifrati con chiave KMS distinta, *Object Lock* (WORM) per resistere a ransomware; test di ripristino mensile automatizzato.
- **Scalabilità**: API e Notification Worker scalano su CPU/coda; lo sweeper scala con istanze multiple grazie a `SKIP LOCKED`; partizionamento mensile di `delivery_attempt` e `audit_log`.
