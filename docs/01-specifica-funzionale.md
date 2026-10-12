# 01 — Specifica funzionale

## 1. Glossario

| Termine | Significato |
|---|---|
| **Titolare** | Utente che crea messaggi nella propria cassaforte (mittente). |
| **Cassaforte (Vault)** | Sezione "Secret Message" del profilo, sbloccabile solo con la *password della cassaforte*. |
| **Password di accesso** | Password di login al profilo. Verificata dal server (hash Argon2id). |
| **Password della cassaforte** | Seconda password, indipendente. **Mai trasmessa al server**: deriva la chiave che decifra la cassaforte. |
| **Chiave di recupero** | 24 parole generate alla creazione della cassaforte; unico modo per recuperarla se si dimentica la password della cassaforte. |
| **Destinatario** | Persona (email e/o cellulare) a cui è indirizzato un messaggio. Può essere o diventare utente registrato. |
| **Codice di accesso** | Segreto con cui il destinatario apre un messaggio (es. `ARANCIO-VELA-7341-LUNA-PONTE-92`). |
| **Esecutore digitale** | Persona di fiducia nominata dal titolare per confermare il decesso. |
| **Trigger** | Condizione che rende consegnabile un messaggio: data, azione manuale, decesso. |
| **Dead man's switch** | Check-in periodico: se il titolare non risponde per un periodo configurato, parte la procedura di verifica decesso. |
| **Periodo di contestazione** | Finestra (default 72 h) tra la conferma del decesso e lo sblocco, durante la quale il titolare può annullare. |

## 2. Attori

| Attore | Descrizione | Permessi |
|---|---|---|
| Visitatore | Non autenticato | Home, informazioni, registrazione, "Ho ricevuto un messaggio", "Cerca messaggi per me" |
| Titolare | Utente registrato | Profilo, cassaforte (dopo sblocco), destinatari, esecutori, impostazioni |
| Destinatario | Utente registrato con messaggi rilasciati | Solo i messaggi a lui indirizzati e rilasciati; nient'altro del profilo del mittente |
| Esecutore digitale | Utente registrato nominato da un titolare | Solo il pannello "Conferma decesso" di quel titolare; **non** vede messaggi né destinatari |
| Operatore di supporto | Staff | Metadati operativi (stati, log tecnici), mai contenuti. Azioni sensibili con doppia approvazione |
| Sistema | Worker, scheduler | Esegue trigger e consegne |

## 3. Requisiti funzionali

Priorità: **M** = MVP, **V1**, **V2**.

### 3.1 Account e autenticazione

| ID | Requisito | Priorità |
|---|---|---|
| RF-01 | Registrazione con nome, email, password di accesso; verifica email tramite link (scadenza 24 h). | M |
| RF-02 | Telefono opzionale, verificato via OTP SMS se inserito. | V1 |
| RF-03 | Login email + password; sessione server-side in cookie `HttpOnly; Secure; SameSite=Lax`; scadenza inattività 30 min, assoluta 12 h. | M |
| RF-04 | Recupero password di accesso via email: token monouso, 30 min, hash del token a DB; invalida tutte le sessioni. **Non** recupera la cassaforte. | M |
| RF-05 | 2FA opzionale: TOTP (RFC 6238) e passkey WebAuthn; 10 codici di backup. Fortemente suggerita in onboarding. | V1 |
| RF-06 | Elenco dispositivi/sessioni attive, revoca singola o totale. | V1 |
| RF-07 | Avviso email per login da nuovo dispositivo. | V1 |
| RF-08 | Lingua IT/EN (rilevata dal browser, modificabile). | M |

### 3.2 Cassaforte

| ID | Requisito | Priorità |
|---|---|---|
| RF-10 | Al primo accesso alla sezione, creazione guidata della password della cassaforte (≥ 12 caratteri o frase di 4+ parole, controllo zxcvbn ≥ 3, **deve differire** dalla password di accesso — verificato lato client). | M |
| RF-11 | Generazione e conferma della **chiave di recupero** (24 parole). L'utente deve riscriverne 3 a caso per proseguire. | M |
| RF-12 | Sblocco cassaforte con password: la chiave vive solo in memoria nel browser; blocco automatico dopo 10 min di inattività, alla chiusura della scheda o con "Blocca ora". | M |
| RF-13 | Rate limiting dei tentativi di sblocco (lato server sul recupero del materiale cifrato): 5 tentativi → attesa progressiva; notifica email al titolare. | M |
| RF-14 | Cambio password della cassaforte (ri-cifra solo la chiave privata, non i messaggi). | M |
| RF-15 | Recupero cassaforte tramite chiave di recupero + reimpostazione password. | M |

### 3.3 Messaggi

| ID | Requisito | Priorità |
|---|---|---|
| RF-20 | Creazione messaggio: titolo (cifrato), corpo in editor ricco (grassetto, corsivo, elenchi, link, emoji). | M |
| RF-21 | Allegati: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.docx` (M); `.doc` (V1, con avviso sui rischi delle macro). Max 25 MB/file, 100 MB/messaggio, quota per piano. Validazione estensione + *magic bytes* lato client prima della cifratura. | M |
| RF-22 | Data di creazione automatica; data "di riferimento" manuale opzionale (es. "scritto per i tuoi 18 anni"). | M |
| RF-23 | Stati: `DRAFT`, `SCHEDULED`, `ARMED` (in attesa di evento), `RELEASING`, `DELIVERED`, `PARTIALLY_DELIVERED`, `CANCELLED`, `FAILED`. | M |
| RF-24 | Modifica consentita finché lo stato non è `RELEASING`/`DELIVERED`. | M |
| RF-25 | Anteprima "come la vedrà il destinatario". | V1 |
| RF-26 | Autosalvataggio cifrato della bozza ogni 10 s. | M |
| RF-27 | Messaggi ricorrenti (es. ogni compleanno per 10 anni, con contenuti diversi). | V2 |
| RF-28 | Messaggi audio/video brevi. | V2 |

### 3.4 Destinatari

| ID | Requisito | Priorità |
|---|---|---|
| RF-30 | Rubrica destinatari: nome, relazione (facoltativa), email e/o cellulare (E.164). Dati cifrati nella cassaforte; il server conosce i recapiti solo nella forma necessaria all'invio (vedi 04). | M |
| RF-31 | Un messaggio può avere 1..N destinatari; ciascuno con canale (email, SMS, entrambi) e livello di consegna del codice. | M |
| RF-32 | Se il destinatario è già utente con cassaforte, opzione "consegna diretta cifrata" (livello 1). | V1 |
| RF-33 | Il titolare può scegliere di **non** notificare in anticipo il destinatario (default) o di avvisarlo che "qualcuno ha preparato qualcosa per te". | V1 |

### 3.5 Trigger e programmazione

| ID | Requisito | Priorità |
|---|---|---|
| RF-40 | Trigger **data fissa**: data + ora + fuso orario del destinatario (default Europe/Rome). Scorciatoie: compleanno, anniversario, matrimonio, maggiore età, altro. | M |
| RF-41 | Trigger **manuale**: "Invia ora" o "Invierò io quando deciderò". | M |
| RF-42 | Trigger **decesso**: richiede almeno un meccanismo di verifica configurato (§3.6). | V1 |
| RF-43 | Combinazioni: "alla data X oppure al decesso, quale arrivi prima". | V1 |
| RF-44 | Promemoria al titolare 7 giorni prima di un invio a data fissa, con possibilità di rinviare/annullare. | V1 |

### 3.6 Testamento digitale (verifica decesso)

| ID | Requisito | Priorità |
|---|---|---|
| RF-50 | **Dead man's switch**: intervallo di check-in (30/60/90/180 giorni). Promemoria via email + SMS + push; il check-in è un clic su link firmato o un login. | V1 |
| RF-51 | **Esecutori digitali**: da 1 a 5; quorum configurabile (es. 2 su 3). Gli esecutori ricevono un invito e accettano il ruolo. Non vedono contenuti né destinatari. | V1 |
| RF-52 | **Monitoraggio necrologi**: il titolare opta-in fornendo nome, cognome, data e luogo di nascita, comune di residenza. Una corrispondenza è solo un **segnale** che avvia la verifica, mai uno sblocco diretto. | V2 |
| RF-53 | Avvio verifica: (a) check-in mancato oltre il periodo di grazia, (b) segnale necrologio, (c) segnalazione di un esecutore. | V1 |
| RF-54 | Verifica: richiesta di conferma agli esecutori; raggiunto il quorum → **periodo di contestazione** (72 h default, configurabile 24 h–14 gg) con tentativi di contatto al titolare su tutti i canali; nessuna contestazione → sblocco. | V1 |
| RF-55 | Il titolare può sempre annullare una procedura in corso con login + sblocco cassaforte (o link di emergenza + 2FA). | V1 |
| RF-56 | Fallback senza esecutori: dopo check-in mancato e N solleciti (default 3 in 30 gg) e periodo di contestazione esteso (14 gg), sblocco automatico. Il titolare deve accettare esplicitamente questo rischio. | V1 |
| RF-57 | Caricamento facoltativo di un certificato di morte da parte dell'esecutore (verifica manuale da operatore con doppia approvazione; il documento viene cancellato dopo la verifica). | V2 |

### 3.7 Consegna e lato destinatario

| ID | Requisito | Priorità |
|---|---|---|
| RF-60 | Notifica email e/o SMS con testo personalizzabile (template predefiniti delicati IT/EN). | M |
| RF-61 | La notifica contiene un **link di consegna** univoco (token 256 bit, hash a DB) e, a seconda del livello, il codice di accesso. Se email e SMS sono entrambi disponibili, link via email e codice via SMS (canali separati). | M |
| RF-62 | Il destinatario si registra o accede; il link associa la consegna al suo account dopo verifica dell'email/telefono a cui è stata inviata. | M |
| RF-63 | Inserito il codice, il messaggio viene decifrato nel browser; download allegati decifrati lato client. Alla prima apertura la chiave del messaggio viene ri-cifrata con la chiave del destinatario (se ha una cassaforte) e il codice smette di servire. | M |
| RF-64 | **Ricerca fallback** "Ci sono messaggi per me?": il visitatore registrato con email/telefono verificati vede le consegne *rilasciate* indirizzate a quei recapiti. In aggiunta, ricerca per nome e cognome del mittente **solo** in combinazione con un codice di accesso valido (vedi nota privacy). | M |
| RF-65 | Il destinatario vede: nome visualizzato del mittente, data di scrittura, messaggio, allegati. Non vede: altri messaggi, altri destinatari, dati del profilo. | M |
| RF-66 | Retry automatici di invio (backoff esponenziale, cambio canale), escalation agli esecutori se la consegna fallisce definitivamente. | M |
| RF-67 | Ricevuta di lettura opzionale per il titolare (solo per messaggi non post-mortem, se il titolare la abilita). | V2 |

> **Nota privacy su RF-64.** Il brief prevede che il destinatario "cerchi il profilo del mittente". Un elenco pubblico e ricercabile degli iscritti a un servizio di messaggi post-mortem esporrebbe dati sensibili (chi è iscritto, chi è morto, chi ha segreti) e sarebbe sfruttabile per phishing. Per questo la ricerca per nome restituisce risultati **solo** se accompagnata da un codice di accesso corretto, e mostra il solo nome visualizzato scelto dal mittente.

### 3.8 Privacy, dati e account

| ID | Requisito | Priorità |
|---|---|---|
| RF-70 | Consensi granulari (termini, privacy, monitoraggio necrologi, marketing separato) con registro versionato. | M |
| RF-71 | Esportazione dati (art. 20 GDPR): pacchetto JSON + file cifrati, decifrabili offline con la password della cassaforte tramite tool open source. | V1 |
| RF-72 | Cancellazione account (art. 17): *crypto-shredding* immediato delle chiavi, cancellazione dati entro 30 gg, backup ruotano entro 35 gg. Messaggi già consegnati restano disponibili ai destinatari solo se il titolare lo sceglie. | M |
| RF-73 | Log di audit consultabile dal titolare (accessi, sblocchi, modifiche, invii). | V1 |

## 4. Requisiti non funzionali

| ID | Categoria | Requisito |
|---|---|---|
| RNF-01 | Riservatezza | Contenuti, titoli, allegati e rubrica cifrati lato client con AES-256-GCM. Il server non riceve mai la password della cassaforte né chiavi in chiaro. |
| RNF-02 | Integrità | Cifratura autenticata (AEAD); `message_id` e versione come *associated data* per impedire lo scambio di ciphertext tra record. |
| RNF-03 | Affidabilità consegna | Nessuna consegna persa: obiettivo ≥ 99,99 % di trigger elaborati entro 5 min dalla scadenza; semantica *at-least-once* con idempotenza = *effectively-once* per destinatario. |
| RNF-04 | Disponibilità | 99,9 % per l'app web; lo scheduler tollera indisponibilità prolungate recuperando gli arretrati. |
| RNF-05 | Durabilità | Backup PostgreSQL cifrati (PITR 14 gg, snapshot giornalieri 35 gg, copia in seconda region); object storage con versioning e replica. RPO ≤ 5 min, RTO ≤ 4 h. |
| RNF-06 | Longevità | Formati e algoritmi documentati e versionati (`crypto_version`) per consentire migrazioni a 20+ anni; piano di continuità in caso di cessazione del servizio (vedi 09). |
| RNF-07 | Prestazioni | TTFB < 300 ms p95; sblocco cassaforte < 1,5 s su smartphone medio (Argon2id tarato: 64 MiB, 3 iterazioni). |
| RNF-08 | Scalabilità | API e worker stateless, scalabili orizzontalmente; sweeper con `SKIP LOCKED` per elaborazione concorrente. |
| RNF-09 | Sicurezza applicativa | OWASP ASVS livello 2 (livello 3 per moduli auth/crypto); CSP rigorosa, CSRF, rate limiting, header di sicurezza. |
| RNF-10 | Accessibilità | WCAG 2.1 AA: contrasto ≥ 4.5:1, navigazione da tastiera, focus visibile, etichette ARIA, `prefers-reduced-motion`. |
| RNF-11 | Internazionalizzazione | IT/EN al lancio; stringhe in file ICU; date e fusi orari per locale. |
| RNF-12 | Osservabilità | Metriche, tracing, log strutturati **senza** contenuti né recapiti in chiaro. |
| RNF-13 | Conformità | GDPR, Codice Privacy (art. 2-terdecies), DPIA prima del lancio, dati in UE. |

## 5. Regole di business principali

1. Una password della cassaforte uguale a quella di accesso viene rifiutata (confronto lato client prima della derivazione).
2. Un messaggio con trigger decesso non può essere salvato come `ARMED` se non esiste almeno un meccanismo di verifica attivo (esecutori con quorum accettato, oppure dead man's switch con fallback esplicitamente accettato).
3. Nessun singolo segnale sblocca un messaggio post-mortem: serve quorum + periodo di contestazione scaduto.
4. Il periodo di contestazione non può essere < 24 h.
5. Un destinatario vede un messaggio solo se: la consegna è `RELEASED`, il suo account ha verificato il recapito a cui è stata indirizzata (o possiede il link di consegna), e fornisce il codice corretto (o possiede la chiave diretta).
6. Gli esecutori non possono essere destinatari degli stessi messaggi in modalità "codice custodito" (separazione dei ruoli; avviso, non blocco, negli altri livelli).
7. Le notifiche post-mortem non vengono mai inviate tra le 22:00 e le 8:00 del fuso del destinatario.
