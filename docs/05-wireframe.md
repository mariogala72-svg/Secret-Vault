# 05 — Wireframe descrittivi

## 0. Linee guida visive e di tono

**Palette** (token CSS, tema chiaro / scuro):

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--bg` | `#FAF8F5` (carta) | `#14161A` | Sfondo |
| `--surface` | `#FFFFFF` | `#1D2026` | Card |
| `--text` | `#22252B` | `#ECEAE6` | Testo (contrasto ≥ 12:1) |
| `--muted` | `#5D626B` | `#A3A8B0` | Testo secondario (≥ 4.5:1) |
| `--accent` | `#4C5F8A` (blu notte) | `#93A7D6` | Azioni primarie |
| `--warm` | `#B5835A` (ambra) | `#D9A97F` | Dettagli emotivi, icona cassaforte |
| `--danger` | `#A23B3B` | `#E08585` | Azioni irreversibili |

**Tipografia**: serif umanista per i titoli (es. *Fraunces* / *Literata*), sans leggibile per l'interfaccia (*Inter*). Corpo 17 px mobile, interlinea 1.6.

**Tono di voce**: seconda persona, frasi brevi, nessun termine burocratico o tecnico non necessario, mai allarmistico. Si parla di "parole", "ricordi", "persone care". Il tema della morte è nominato con rispetto ("quando non ci sarai più", "se ti dovesse succedere qualcosa"), mai eluso al punto da essere ambiguo.

**Accessibilità**: target touch ≥ 44 px, focus ring visibile 2 px, tutte le icone con etichetta, errori annunciati con `aria-live`, nessuna informazione veicolata solo dal colore, animazioni disattivate con `prefers-reduced-motion`.

---

## 1. Registrazione / Login

```
┌─────────────────────────────────────┐
│  🔒 Secret Vault            IT | EN │
├─────────────────────────────────────┤
│                                     │
│   Le parole che vuoi lasciare,      │
│   al sicuro.                        │
│                                     │
│   [ Accedi ]  [ Crea un account ]   │  ← tab
│                                     │
│   Nome e cognome                    │
│   [_____________________________]   │
│   Come ti vedranno i destinatari    │
│                                     │
│   Email                             │
│   [_____________________________]   │
│                                     │
│   Password di accesso               │
│   [_________________________] 👁    │
│   ▓▓▓▓▓▓░░░  Buona                  │
│   Serve per entrare nel profilo.    │
│   Per i tuoi messaggi ne creerai    │
│   un'altra, separata.               │
│                                     │
│   ☐ Accetto i Termini e l'Informativa│
│     privacy (link)                  │
│                                     │
│   [      Crea il mio account      ] │
│                                     │
│   Hai ricevuto un messaggio?        │
│   → Scopri come leggerlo            │
└─────────────────────────────────────┘
```

- **Login**: email, password, link "Password dimenticata?", poi eventuale schermata 2FA (codice a 6 cifre o "Usa passkey").
- **Dopo la registrazione**: schermata "Controlla la tua email" con reinvio dopo 60 s.
- **Errori**: "Email o password non corretti" (mai specificare quale).
- **Onboarding (3 passi)** dopo la verifica: 1) cosa puoi fare, 2) attiva la verifica in due passaggi (consigliata, saltabile), 3) crea la tua cassaforte (o "più tardi").

---

## 2. Dashboard profilo

```
┌─────────────────────────────────────────────┐
│ ☰  Secret Vault          🔔   👤 Giulia ▾  │
├─────────────────────────────────────────────┤
│ Buongiorno, Giulia.                         │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔒 La tua cassaforte è chiusa            │ │
│ │ I tuoi messaggi sono protetti da una     │ │
│ │ seconda password.                        │ │
│ │              [ Apri la cassaforte ]      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │   2     │ │   3     │ │   1     │         │
│ │ Bozze   │ │Programm.│ │ Inviati │         │
│ └─────────┘ └─────────┘ └─────────┘         │
│  (numeri visibili; titoli solo a cassaforte │
│   aperta)                                   │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 💛 Testamento digitale                   │ │
│ │ Ultimo check-in: 12 settembre            │ │
│ │ Prossimo: entro 11 dicembre              │ │
│ │ Esecutori: Marco ✓  Sara ✓  Luca (invito)│ │
│ │                      [ Sono qui ✓ ]      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📬 Messaggi ricevuti                     │ │
│ │ Nessun messaggio per te, per ora.        │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ⚙ Sicurezza · Privacy e dati · Aiuto        │
└─────────────────────────────────────────────┘
```

- Su desktop: sidebar sinistra (Panoramica, Cassaforte, Destinatari, Testamento digitale, Messaggi ricevuti, Impostazioni).
- Se un caso decesso è aperto per l'utente stesso: banner rosso prioritario "Abbiamo avviato una verifica perché non ti sentivamo da tempo. Se stai bene, conferma qui." con un solo pulsante.

---

## 3. Sblocco Secret Message (2ª password)

```
┌─────────────────────────────────────┐
│ ← Indietro                          │
│                                     │
│              ( 🔒 )                 │  ← icona cassaforte, animazione
│                                     │     di apertura al successo
│        La tua cassaforte            │
│                                     │
│  Inserisci la password della        │
│  cassaforte. È diversa da quella    │
│  con cui hai fatto l'accesso.       │
│                                     │
│  [___________________________] 👁   │
│                                     │
│  [        Apri        ]             │
│                                     │
│  Non la ricordi?                    │
│  → Usa la chiave di recupero        │
│                                     │
│  ⓘ Nemmeno noi possiamo vedere i    │
│    tuoi messaggi. Per questo non     │
│    possiamo reimpostare questa       │
│    password via email.               │
└─────────────────────────────────────┘
```

- Durante la derivazione (≈1 s): spinner con testo "Sto aprendo la cassaforte…".
- Errore: "Password non corretta. Hai ancora 4 tentativi prima di una breve pausa."
- Blocco: "Per proteggerti, riprova tra 15 minuti. Ti abbiamo avvisato via email."
- **Prima configurazione**: wizard in 3 passi — scegli password (con confronto "diversa da quella di accesso" e misuratore) → mostra 24 parole della chiave di recupero (pulsanti "Stampa" / "Scarica PDF", avviso "conservala in un luogo sicuro, ad esempio insieme ai tuoi documenti importanti") → verifica 3 parole.
- A cassaforte aperta: indicatore persistente in header "🔓 Cassaforte aperta · Blocca" con conto alla rovescia di inattività.

---

## 4. Editor nuovo messaggio (passo 1 di 4)

Onboarding guidato a step: **1. Scrivi → 2. Allegati → 3. Destinatari → 4. Quando**.

```
┌─────────────────────────────────────────────┐
│ ✕   Nuovo messaggio        ● ○ ○ ○   Salvato│
├─────────────────────────────────────────────┤
│ Titolo (lo vedrai solo tu e i destinatari)  │
│ [Per i tuoi 18 anni_______________________] │
│                                             │
│ B  I  U  • ≡  🔗  😊  ↶ ↷                   │  ← toolbar accessibile
│ ┌─────────────────────────────────────────┐ │
│ │ Caro Tommaso,                            │ │
│ │                                          │ │
│ │ oggi diventi grande…                     │ │
│ │                                          │ │
│ │                                          │ │
│ └─────────────────────────────────────────┘ │
│ 💡 Non sai da dove cominciare?              │
│    → Spunti di scrittura                    │
│                                             │
│ Scritto il 12 ottobre 2026  (modifica)      │
│                                             │
│ 🔒 Cifrato sul tuo dispositivo              │
│                         [ Avanti → ]        │
└─────────────────────────────────────────────┘
```

**Passo 2 — Allegati**

```
┌─────────────────────────────────────────────┐
│  Aggiungi foto o documenti (facoltativo)    │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│   Trascina qui i file o  [ Scegli file ]    │
│   PDF, Word, JPG, PNG · fino a 25 MB        │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│  🖼 noi_al_mare.jpg     3,2 MB  ▓▓▓▓▓ ✓  ✕  │
│  📄 lettera_nonno.pdf   1,1 MB  ▓▓▓░░ 60%   │
│  Spazio usato: 4,3 MB di 1 GB               │
│              [ ← Indietro ] [ Avanti → ]    │
└─────────────────────────────────────────────┘
```

---

## 5. Selezione destinatari e trigger

**Passo 3 — Destinatari**

```
┌─────────────────────────────────────────────┐
│  A chi è destinato?               ● ● ● ○   │
│                                             │
│  🔍 [Cerca nella rubrica____________]       │
│                                             │
│  ☑ Tommaso (figlio)                         │
│     ✉ tommaso@…   📱 +39 33…               │
│     Invia tramite: (●) Email e SMS          │
│                    ( ) Solo email ( ) Solo SMS│
│     Codice di accesso:                      │
│     (●) Lo custodisce Secret Vault e lo     │
│         invia al momento giusto  ⓘ          │
│     ( ) Glielo darò io (massima riservatezza)│
│                                             │
│  ☐ Anna (sorella)                           │
│                                             │
│  [ + Aggiungi una persona ]                 │
│                                             │
│              [ ← Indietro ] [ Avanti → ]    │
└─────────────────────────────────────────────┘
```

- Il pannello ⓘ spiega i livelli con linguaggio semplice: *"Se lo custodiamo noi, nessuno, nemmeno noi, potrà leggerlo prima della data scelta. Se preferisci che non passi mai da noi, puoi darlo tu a Tommaso: ti mostreremo il codice da scrivere o stampare."*
- Se il contatto è già utente: badge "✓ Usa Secret Vault — consegna diretta, nessun codice necessario".
- Se si sceglie "Glielo darò io": schermata con il codice in grande, pulsanti "Copia" / "Stampa biglietto", checkbox "Ho conservato il codice".

**Passo 4 — Quando**

```
┌─────────────────────────────────────────────┐
│  Quando vuoi che arrivi?          ● ● ● ●   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📅  In una data speciale               │  │
│  │     Compleanno · Anniversario ·        │  │
│  │     Matrimonio · 18 anni · Altro       │  │
│  │     [ 14/03/2034 ]  [ 09:00 ]          │  │
│  │     Fuso: Europe/Rome ▾                │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ 💛  Quando non ci sarò più             │  │
│  │     Richiede il testamento digitale    │  │
│  │     (esecutori o check-in periodico)   │  │
│  │     ☐ …oppure alla data sopra, se      │  │
│  │       arriva prima                     │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ 📩  Lo invierò io                      │  │
│  │     ( ) Adesso  ( ) Quando deciderò    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Riepilogo                                  │
│  "Per i tuoi 18 anni" → Tommaso             │
│  il 14 marzo 2034 alle 9:00, via email e SMS│
│                                             │
│        [ Salva bozza ] [ Programma 🔒 ]     │
└─────────────────────────────────────────────┘
```

- Selezionando "Quando non ci sarò più" senza testamento digitale attivo: modale "Prima di continuare, scegli come accorgerci che non ci sei più" → link al wizard esecutori / check-in.
- Conferma finale: "Il tuo messaggio è al sicuro. Te lo ricorderemo una settimana prima, così potrai ancora cambiarlo."

### Wizard testamento digitale

1. **Come vuoi che ce ne accorgiamo?** — ☑ Check-in periodico (ogni 90 gg ▾) — ☑ Persone di fiducia — ☐ Monitoraggio necrologi (V2, con consenso dedicato).
2. **Persone di fiducia**: aggiungi 1–5 esecutori (nome, email), quorum ("servono 2 conferme su 3"). Testo: *"Non vedranno mai i tuoi messaggi né a chi sono indirizzati. Il loro compito è solo confermare, con delicatezza, ciò che è accaduto."*
3. **Tempo per ripensarci**: periodo di contestazione (72 h ▾) — *"Prima di inviare, ti cercheremo ovunque per 72 ore. Se sei tu, basta un clic per fermare tutto."*
4. **Riepilogo + consenso esplicito** (con opzione sblocco senza esecutori e relativo avviso).

---

## 6. Schermata destinatario

**6a. Notifica email** (template)

```
Oggetto: Giulia Rossi ha lasciato un messaggio per te

Ciao Tommaso,

Giulia Rossi ha scritto qualcosa per te e ha chiesto a Secret Vault
di custodirlo fino a oggi.

        [ Leggi il messaggio ]   ← link di consegna univoco

Per aprirlo ti servirà un codice di accesso, che ti abbiamo inviato
per SMS al numero che termina con •••47.

Prenditi il tempo che ti serve: il messaggio resterà disponibile.

Secret Vault non ti chiederà mai la password del tuo account email
o dati bancari. Come riconoscere una vera notifica → link
```

**SMS** (≤ 160 caratteri, separato): `Secret Vault: il codice per il messaggio di Giulia R. è K7MQ-2XRT-9DPA-4WNE-H3CV. Il link ti è arrivato via email.`

Versione solo SMS: `Ciao Tommaso, Giulia R. ti ha lasciato un messaggio su secretvault.app/r/AbC123. Codice: K7MQ-2XRT-9DPA-4WNE-H3CV`

Versione post-mortem: l'oggetto e l'apertura sono più delicati — *"Ciao Tommaso, ci dispiace molto per la perdita di Giulia. Prima di andarsene, Giulia ha voluto lasciarti un messaggio…"* (testo approvato da uno psicologo del lutto in fase di design).

**6b. Atterraggio dal link**

```
┌─────────────────────────────────────┐
│  🔒 Secret Vault                    │
│                                     │
│  C'è un messaggio per te            │
│  da Giulia Rossi                    │
│                                     │
│  Per proteggerlo, ti chiediamo di   │
│  accedere o creare un account       │
│  gratuito con l'email a cui hai     │
│  ricevuto questo invito.            │
│                                     │
│  [ Crea un account ]  [ Accedi ]    │
│                                     │
│  ⓘ Vedrai solo ciò che Giulia ha    │
│    scritto per te.                  │
└─────────────────────────────────────┘
```

**6c. Inserimento codice e lettura**

```
┌─────────────────────────────────────┐
│ Da Giulia Rossi · scritto il        │
│ 3 maggio 2026                       │
│                                     │
│ Codice di accesso                   │
│ [K7MQ]-[2XRT]-[9DPA]-[4WNE]-[H3CV]  │
│          [ Apri il messaggio ]      │
└─────────────────────────────────────┘
          ↓ (decifrazione nel browser)
┌─────────────────────────────────────┐
│ ← Messaggi ricevuti                 │
│                                     │
│   Per i tuoi 18 anni                │
│   da Giulia · 3 maggio 2026         │
│   ───────────────────────           │
│   Caro Tommaso,                     │
│   oggi diventi grande…              │
│                                     │
│   Allegati                          │
│   🖼 noi_al_mare.jpg    [Scarica]   │
│   📄 lettera_nonno.pdf  [Scarica]   │
│                                     │
│   [ Salva una copia ]               │
│   [ Conservalo nella mia cassaforte]│
│                                     │
│   💬 Se hai bisogno di parlarne con │
│   qualcuno → risorse di supporto    │
└─────────────────────────────────────┘
```

- Il messaggio si apre su una "busta" che si dischiude lentamente (disattivabile con riduzione movimento).
- **"Ci sono messaggi per me?"** (fallback, pagina pubblica): spiega che basta registrarsi e verificare la propria email/telefono; mostra eventuali consegne rilasciate per quei recapiti. In alternativa campo "Nome e cognome di chi ti ha scritto" + codice.
- **Pannello esecutore** (schermata separata, non mostrata): *"Ci è stato segnalato che Giulia Rossi potrebbe essere venuta a mancare. Ti chiediamo, se te la senti, di confermarlo."* → [Confermo] [Non è così] [Non lo so] + campo note facoltativo.
