# 09 — Considerazioni etiche e legali

> Questo documento è un'analisi progettuale, non un parere legale. Prima del lancio è necessaria la revisione di un avvocato esperto in protezione dati e diritto successorio, e la redazione della DPIA con il DPO.

## 1. Inquadramento GDPR

| Tema | Analisi e scelta progettuale |
|---|---|
| **Titolare del trattamento** | La società che gestisce Secret Vault, per i dati di account, recapiti, metadati, log. Per i *contenuti* dei messaggi, cifrati lato client e inaccessibili, il ruolo è di mero custode tecnico; vanno comunque trattati come dati personali potenzialmente di categoria particolare (salute, orientamento, convinzioni: art. 9). |
| **Basi giuridiche** (art. 6) | Utente: esecuzione del contratto (b). Destinatari ed esecutori, i cui dati sono forniti dal titolare: legittimo interesse (f) del titolare e della società a eseguire la consegna richiesta, con bilanciamento documentato e informativa al primo contatto (art. 14). Monitoraggio necrologi: consenso esplicito (a), separato e revocabile. Marketing: consenso separato. |
| **Informativa ai destinatari** (art. 14) | Fornita al momento della notifica (non prima, per non svelare il messaggio: deroga art. 14.5.b da motivare nella DPIA, dato che informare in anticipo comprometterebbe la finalità voluta dal titolare). |
| **Minimizzazione** | Recapiti dei destinatari cifrati lato server con blind index; IP troncati; log senza contenuti; nessun tracking pubblicitario; analytics privacy-friendly senza cookie. |
| **Diritto all'oblio** (art. 17) | Crypto-shredding immediato + cancellazione entro 30 gg + rotazione backup entro 35 gg. Il destinatario può cancellare la propria copia ricevuta. |
| **Portabilità** (art. 20) | Export cifrato + tool open source per leggerlo offline. |
| **Sicurezza** (art. 32) | Cifratura E2E, Argon2id, 2FA, audit, backup cifrati, pen test. |
| **DPIA** (art. 35) | Obbligatoria: trattamento su larga scala di dati potenzialmente particolari, tecnologie innovative, monitoraggio (necrologi), soggetti vulnerabili (persone in lutto). |
| **Trasferimenti extra UE** | Hosting e database in UE. Provider USA (Resend, Twilio, eventualmente Vercel): DPA + SCC / EU-US Data Privacy Framework, dati minimi (solo recapito e testo della notifica). Preferire region UE dove disponibili. |
| **Data breach** (artt. 33–34) | Procedura di notifica entro 72 h; la cifratura client riduce l'impatto (art. 34.3.a può escludere la comunicazione agli interessati per i contenuti). |
| **Minori** | Registrazione consentita dai 14 anni (art. 2-quinquies Codice Privacy); i minori possono essere destinatari: le notifiche a minori sono consentite, ma il titolare viene invitato a indicare un adulto di riferimento. |

## 2. Dati delle persone decedute

- Il GDPR non si applica ai dati dei defunti (considerando 27), ma in Italia l'**art. 2-terdecies del Codice Privacy** (D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018) consente che i diritti degli artt. 15–22 siano esercitati da chi ha un interesse proprio, agisce a tutela dell'interessato in qualità di mandatario, o per ragioni familiari meritevoli di protezione.
- Lo stesso articolo consente all'interessato di **vietare** l'esercizio di tali diritti da parte di terzi con dichiarazione scritta presentata al titolare. **Secret Vault offre questa funzione**: il titolare può dichiarare, per ogni messaggio o in generale, che nessun erede possa accedere o chiedere la cancellazione dei suoi messaggi, ad eccezione dei destinatari designati. La dichiarazione è revocabile e registrata.
- Procedura per eredi che chiedono accesso: **non possiamo** fornire contenuti (cifrati), ma possiamo indicare l'esistenza dell'account e gestire la cancellazione, nel rispetto delle volontà espresse dal titolare.

## 3. Secret Vault non è un testamento

- Nel diritto italiano il testamento ha forme tassative (olografo: interamente scritto a mano, datato e sottoscritto — art. 602 c.c.; pubblico o segreto con notaio). **Un messaggio digitale non ha valore di testamento** e non può disporre validamente dei beni.
- L'app deve dirlo chiaramente in onboarding, nei ToS e nell'editor dei messaggi post-mortem ("Questo messaggio non sostituisce un testamento. Per disposizioni sui tuoi beni rivolgiti a un notaio.").
- Possibile valore aggiunto lecito: il messaggio può *indicare dove si trova* il testamento, o contenere istruzioni non vincolanti (desideri sul funerale, password di account, ricordi).
- **Credenziali di terzi** nei messaggi (es. home banking): sconsigliare esplicitamente; i ToS dei servizi terzi spesso vietano la cessione delle credenziali e l'uso da parte di eredi può avere rilevanza penale (accesso abusivo, art. 615-ter c.p.) o successoria. Indicare invece gli strumenti ufficiali (es. contatto erede di Apple, account inattivo di Google).

## 4. Responsabilità

| Scenario | Posizione e mitigazione |
|---|---|
| Consegna mancata o in ritardo | Obbligazione di mezzi con SLA dichiarati; limitazione di responsabilità nei limiti consentiti (non per dolo o colpa grave, art. 1229 c.c.; clausole vessatorie da approvare specificamente, artt. 1341–1342 c.c.; tutela del consumatore, Codice del Consumo). Log di audit come prova della diligenza. |
| Consegna prematura (falso decesso) | Rischio più grave: quorum, contestazione, procedure documentate; assicurazione RC professionale/cyber. |
| Contenuto illecito (diffamazione, minacce, rivelazione di segreti altrui) | Responsabilità dell'autore (ToS); il servizio è hosting di contenuti cifrati non conoscibili; canale di segnalazione per destinatari; collaborazione con l'autorità nei limiti tecnici (metadati). |
| Effetti emotivi/familiari del messaggio | Non attribuibili al servizio, ma gestiti con design responsabile (quiet hours, risorse di supporto, possibilità per il destinatario di non leggere). |
| Richieste dell'autorità giudiziaria | Possiamo fornire solo metadati; trasparenza tramite *transparency report* annuale. |

## 5. Considerazioni etiche

1. **Consenso del destinatario**: ricevere un messaggio da una persona morta può essere doloroso. Il destinatario sceglie se e quando aprirlo; la notifica non contiene anteprime del contenuto; c'è sempre un'opzione "Non ora" e "Non desidero ricevere messaggi da questa persona".
2. **Rivelazioni postume**: segreti che coinvolgono terzi (figli non riconosciuti, tradimenti, malattie) possono avere conseguenze serie. In fase di scrittura dei messaggi post-mortem mostriamo un promemoria gentile e non giudicante: *"Prima di programmarlo, pensa a come potrebbe sentirsi chi lo leggerà, e se riguarda anche altre persone."*
3. **Rischio di controllo e abuso**: un ex partner potrebbe usare messaggi programmati per molestare. Contromisure: segnalazione, blocco, limiti per account nuovi, verifica dell'identità del mittente per volumi elevati.
4. **Esecutori**: ruolo emotivamente gravoso. Comunicazioni brevi, delicate, possibilità di rinunciare in qualunque momento, nessuna esposizione ai contenuti.
5. **Nessuna monetizzazione del lutto**: niente upsell nelle schermate del destinatario o dell'esecutore, niente pubblicità, niente uso dei dati per profilazione. Modello di business trasparente (abbonamento del titolare o pagamento una tantum per conservazione pluriennale).
6. **Inclusività**: utenti anziani, persone con disabilità, bassa alfabetizzazione digitale. Test di usabilità con questi gruppi; supporto umano raggiungibile.
7. **Onestà sulla sicurezza**: l'interfaccia spiega in modo semplice cosa possiamo e non possiamo vedere, compresi i limiti del livello L3 (vedi 04).

## 6. Continuità del servizio (promessa a lungo termine)

Un servizio che promette di consegnare un messaggio fra 30 anni assume un impegno che supera la vita media di una startup. Misure:

- **Clausola di continuità** nei ToS e accordo con un soggetto terzo (fondazione, studio notarile, operatore di conservazione digitale) che subentra nella gestione delle consegne in caso di cessazione.
- **Fondo di riserva** dedicato ai costi operativi delle consegne già pagate.
- **Formati aperti e documentati** (`packages/crypto`) e tool offline open source, così che i dati siano utilizzabili anche senza l'azienda.
- **Export preventivo**: in caso di cessazione annunciata, ogni titolare riceve un preavviso di almeno 12 mesi e la possibilità di esportare; per i titolari deceduti, le consegne L3 vengono anticipate solo se previsto dalle loro istruzioni, altrimenti affidate al soggetto subentrante.

## 7. Altri adempimenti

- **ePrivacy / cookie**: solo cookie tecnici (sessione, lingua, CSRF); nessun banner necessario se non si usano analytics con cookie.
- **SMS**: registrazione del sender ID alfanumerico (in Italia presso il registro AGCOM degli alias SMS), messaggi esclusivamente transazionali.
- **Email**: messaggi transazionali; nessuna newsletter senza consenso.
- **Accessibilità**: oltre a WCAG 2.1 AA, l'European Accessibility Act (D.Lgs. 82/2022, in vigore dal 28/6/2025) si applica ai servizi digitali B2C rilevanti: verificarne l'applicabilità e predisporre la dichiarazione di accessibilità.
- **Fiscale/consumatore**: diritto di recesso di 14 giorni per abbonamenti venduti online, informazioni precontrattuali, prezzi chiari per conservazioni pluriennali.
- **Documenti da redigere**: Termini di servizio, Informativa privacy (utenti, destinatari, esecutori), Cookie policy, DPIA, Registro dei trattamenti (art. 30), DPA con i fornitori, Policy di conservazione, Procedura data breach, Policy di gestione delle richieste dell'autorità, Linee guida per gli esecutori.
