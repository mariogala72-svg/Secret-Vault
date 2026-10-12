# 04 — Crittografia e sicurezza

## 1. Obiettivi di sicurezza

| # | Obiettivo | Contro chi |
|---|---|---|
| S1 | Nessuno tranne titolare e destinatari designati legge i contenuti | Admin, staff, hosting provider, attaccante con dump DB/storage, ordine di esibizione |
| S2 | Nessuno può leggere un messaggio **prima** del suo trigger | Anche un destinatario curioso o un esecutore |
| S3 | Accesso al profilo ≠ accesso alla cassaforte | Familiare con il telefono sbloccato, sessione rubata |
| S4 | Nessun rilascio post-mortem da un singolo segnale | Omonimi, esecutore malintenzionato, social engineering |
| S5 | Integrità e non sostituibilità dei messaggi | Attaccante con accesso in scrittura al DB |
| S6 | Consegna garantita nonostante guasti | Downtime, provider email/SMS, bug |

**Fuori dal perimetro** (rischi accettati e dichiarati): dispositivo del titolare compromesso da malware; titolare costretto a sbloccare; server che distribuisce JavaScript malevolo al client (mitigato, non eliminato — vedi §7).

## 2. Gerarchia delle chiavi

```
Password cassaforte ──Argon2id(salt, m=64MiB, t=3, p=1)──► KEK_pwd (256 bit) ─┐
Chiave di recupero (24 parole BIP-39, 256 bit) ──HKDF──► KEK_rec ──────────────┤
                                                                                │ AES-256-GCM
                                                                                ▼
                                           Vault keypair X25519  (sk cifrata 2 volte: KEK_pwd, KEK_rec)
                                                    │
                                                    │ crypto_box_seal (X25519 + XSalsa20-Poly1305)
                                                    ▼
                                    DEK messaggio (256 bit, casuale, una per messaggio)
                                                    │ AES-256-GCM, AAD = message_id|version|campo
                                                    ▼
                         titolo, corpo, metadati allegati, chunk allegati (secretstream)

Per ogni destinatario, la stessa DEK viene "wrappata" anche con:
   L1  crypto_box_seal(DEK, pubkey_destinatario)
   L2/L3  AES-256-GCM(DEK, Argon2id(codice_accesso, code_kdf_salt))
```

Proprietà:
- **Cambio password cassaforte** = ricifrare solo `sk` (millisecondi), non i messaggi.
- **Cancellazione** = distruggere `enc_private_key_*` e le DEK wrappate → i ciphertext diventano rumore (*crypto-shredding*), anche nei backup.
- **Versioning**: ogni busta inizia con `crypto_version` (1 byte) + `alg_id`; permette migrazione futura (es. a schemi post-quantum ibridi X25519+ML-KEM per le chiavi a lungo termine, rilevante per messaggi che devono restare segreti decenni).

### Formato busta (v1)
```
| ver (1) | alg (1) | nonce (12) | ciphertext (n) | tag (16) |
AAD = "sv:v1:" || record_type || ":" || record_id || ":" || field || ":" || version
```

## 3. Doppia autenticazione: profilo e cassaforte

| | Password di accesso | Password della cassaforte |
|---|---|---|
| Dove viene verificata | Server (Argon2id hash) | **Solo nel browser** (se la decifrazione AES-GCM fallisce, la password è errata) |
| Viaggia sulla rete | Sì, su TLS, una volta al login | **Mai** |
| Recuperabile via email | Sì | **No**: solo con la chiave di recupero |
| Cosa protegge | Accesso all'account, metadati, gestione | Contenuti, titoli, rubrica |

Il server, pur non verificando la password della cassaforte, applica comunque un **rate limit**: il materiale cifrato (`enc_private_key_pwd`) viene servito solo a sessioni autenticate (+ 2FA se attiva), con contatore di richieste e blocco progressivo; ogni tentativo fallito viene segnalato dal client e registrato. Un attaccante con dump del DB può tentare offline: per questo Argon2id con parametri pesanti e password con punteggio zxcvbn ≥ 3 (stima > 10^10 tentativi × ~0,5 s ciascuno).

## 4. I tre livelli di consegna del codice

Il nodo centrale: **chi conosce il codice nel momento dell'invio?**

| Livello | Nome UI | Come funziona | Il server può leggere? | Quando usarlo |
|---|---|---|---|---|
| **L1** | "Consegna diretta" | Destinatario già iscritto con cassaforte: DEK sigillata con la sua chiave pubblica. La notifica dice solo "c'è un messaggio per te". | **Mai** | Destinatario che usa già Secret Vault |
| **L2** | "Codice consegnato da me" | Il browser genera il codice; il titolare lo comunica di persona, in una lettera, nel testamento, dal notaio. Il server ha solo `wrapped_dek` (cifrata con Argon2id(codice)). | **Mai** (codice 100 bit: brute force impraticabile) | Massima riservatezza |
| **L3** | "Codice custodito da Secret Vault" (default) | Il codice viene **sigillato** e aperto dal sistema solo al trigger, poi inserito nella notifica. | **Non prima del trigger**; al trigger il Release Worker lo vede in memoria per pochi istanti, poi lo distrugge | Comodità, destinatari non iscritti |

### L3 per data fissa: timelock drand
Il codice viene cifrato nel browser con **tlock** verso il round del beacon drand corrispondente a `due_at`. Finché drand non pubblica la firma di quel round (cioè fino alla data), **nessuno al mondo**, nemmeno noi, può decifrarlo. Il ciphertext viene ulteriormente avvolto con la KMS release key (difesa in profondità: dopo la data serve comunque il Release Worker).

### L3 per decesso: Shamir + KMS
Il codice viene diviso nel browser con Shamir in `n = E + 1` parti con soglia `t = quorum + 1`:
- 1 parte al **server**, cifrata con la KMS release key;
- 1 parte a ciascun **esecutore**, sigillata con la sua chiave pubblica.

Il server da solo non può ricostruire il codice. Quando un esecutore conferma il decesso, il suo browser apre la propria parte e la ri-cifra verso la chiave pubblica di rilascio del server. Raggiunto il quorum e scaduto il periodo di contestazione, il Release Worker ricombina e invia.

> Se il titolare sceglie il fallback **senza esecutori** (RF-56), la parte del server diventa l'intero codice cifrato con KMS: la protezione si riduce a controlli organizzativi (HSM, IAM, audit). L'interfaccia lo dichiara esplicitamente.

### Dopo la prima apertura
Quando il destinatario apre il messaggio con il codice, se ha (o crea) una cassaforte, il browser ri-sigilla la DEK con la sua chiave pubblica (L1) e la `wrapped_dek` basata sul codice viene eliminata: il codice, anche se intercettato in seguito, non serve più.

### Separazione dei canali
Con email e SMS disponibili: **link via email, codice via SMS**. Una casella email compromessa non basta.

## 5. Recapiti dei destinatari

Il server deve conoscere email/telefono per inviare. Scelte:
- nella **rubrica** del titolare sono cifrati lato client (`contact.enc_payload`);
- nella **consegna** sono `sealed_` (cifratura applicativa con chiave KMS distinta dalla release key) + **blind index** HMAC per la ricerca "ci sono messaggi per me?";
- mai nei log, mai in chiaro nelle metriche; mascherati nell'UI di supporto (`m***@g***.com`).

## 6. Autenticazione e sessioni

- Hash password: **Argon2id** (m=64 MiB, t=3, p=1) con *pepper* da Secret Manager; controllo contro password violate (HIBP k-anonymity).
- Sessioni server-side: token 256 bit in cookie `__Host-sid; HttpOnly; Secure; SameSite=Lax`, a DB solo l'hash. Rotazione dopo login e dopo step-up.
- **Step-up**: azioni sensibili (cambio email, disattivazione 2FA, cancellazione account, modifica esecutori, annullamento caso decesso) richiedono password + 2FA recenti (< 5 min).
- 2FA: TOTP e **passkey WebAuthn** (resistenti al phishing); codici di backup monouso hashati.
- Reset password: token monouso 30 min; non rivela se l'email esiste; revoca sessioni.
- Messaggi d'errore uniformi; tempi di risposta costanti su login/reset.

## 7. Difese applicative (OWASP)

| Minaccia | Contromisura |
|---|---|
| XSS (critico: in una pagina con chiavi in memoria) | CSP rigorosa con nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`), Trusted Types, TipTap con schema chiuso, DOMPurify al rendering, link esterni con `rel="noopener noreferrer"` e conferma |
| Supply chain JS / server che serve codice malevolo | Dipendenze bloccate e verificate, SRI, build riproducibili, pubblicazione degli hash dei bundle, audit esterni del Crypto Engine; in v2 estensione/app con codice firmato per chi vuole garanzie superiori |
| CSRF | SameSite + token sincronizzato (double submit) per richieste mutanti; verifica `Origin` |
| SQL injection | ORM parametrizzato; SQL raw solo con parametri; utente DB con privilegi minimi; RLS come difesa in profondità |
| Rate limiting / brute force | Redis sliding window per IP + account + endpoint (login 5/15 min, reset 3/h, codice destinatario 5 tentativi poi blocco 24 h e avviso), CAPTCHA privacy-friendly (Turnstile) dopo soglia |
| Enumerazione utenti | Risposte identiche per email esistenti/non esistenti; ricerca mittente solo con codice valido |
| IDOR | Ogni query filtrata per `owner_id`/`redeemed_by` lato server; test automatici di autorizzazione per ogni endpoint |
| Upload malevoli | Whitelist estensioni + magic bytes lato client; limiti di dimensione lato server; download con `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`; avviso su `.doc/.docx` (macro). Antivirus server-side impossibile su file E2E: dichiararlo |
| Clickjacking | `frame-ancestors 'none'` |
| Trasporto | TLS 1.3, HSTS preload |
| Segreti | Secret Manager, rotazione, secret scanning in CI |
| Phishing che imita le notifiche | Dominio dedicato con SPF/DKIM/DMARC `p=reject`, BIMI; le notifiche non chiedono **mai** la password di accesso; pagina pubblica "Come riconoscere una vera notifica Secret Vault" |

## 8. Audit, backup e risposta agli incidenti

- **Audit log** append-only con hash chain (ogni riga include l'hash della precedente); ancoraggio giornaliero dell'ultimo hash in un bucket WORM. Il titolare vede i propri eventi.
- **Accesso staff**: solo metadati, tramite pannello con SSO + hardware key, *just-in-time access*, doppia approvazione per azioni sul caso decesso, ogni accesso loggato e visibile.
- **Backup**: cifrati con chiave KMS dedicata, Object Lock, seconda region UE, test di restore mensile.
- **Incident response**: runbook, notifica al Garante entro 72 h (art. 33 GDPR), comunicazione agli interessati. Grazie alla cifratura client, un data breach del DB espone metadati, non contenuti.
- **Penetration test** prima del lancio pubblico e annualmente; bug bounty dalla v1.
