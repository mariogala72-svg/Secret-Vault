import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;
function resend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY non configurata");
  return (client ??= new Resend(process.env.RESEND_API_KEY));
}

const FROM = () => process.env.EMAIL_FROM ?? "Secret Vault <onboarding@resend.dev>";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Block = { p?: string; button?: { label: string; href: string }; code?: string; small?: string; quote?: string };

function layout(title: string, blocks: Block[], preheader = "") {
  const body = blocks
    .map((b) => {
      if (b.p) return `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#2a2d34">${b.p}</p>`;
      if (b.quote) return `<div style="margin:0 0 18px;padding:14px 18px;border-left:3px solid #c9965f;background:#faf6f0;border-radius:8px;font-size:15px;line-height:1.6;color:#4a4d55">${b.quote}</div>`;
      if (b.button)
        return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:linear-gradient(135deg,#6d5bd0,#c9965f)"><a href="${esc(b.button.href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(b.button.label)}</a></td></tr></table>`;
      if (b.code)
        return `<div style="margin:0 0 20px;padding:18px;border-radius:14px;background:#14131c;text-align:center"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a99ee8;margin-bottom:8px">Codice di accesso</div><div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:22px;letter-spacing:.08em;color:#f5e6d3;font-weight:700">${esc(b.code)}</div></div>`;
      if (b.small) return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#7a7d85">${b.small}</p>`;
      return "";
    })
    .join("\n");
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f0ea;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
<tr><td style="padding:0 8px 18px;font-size:15px;font-weight:700;color:#2a2d34;letter-spacing:.02em">🔐 Secret Vault</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:36px 32px;box-shadow:0 8px 30px rgba(20,19,28,.06)">
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.3;color:#14131c;font-weight:600">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.6;color:#8a8d95">Secret Vault non ti chiederà mai la password della tua email, dati bancari o pagamenti. Se non ti aspettavi questa email puoi ignorarla.</td></tr>
</table></td></tr></table></body></html>`;
}

function textOf(title: string, blocks: Block[]) {
  return [
    title,
    "",
    ...blocks.map((b) => (b.p ?? b.quote ?? b.small ?? (b.button ? `${b.button.label}: ${b.button.href}` : b.code ? `Codice di accesso: ${b.code}` : "")).replace(/<[^>]+>/g, "")),
  ].join("\n\n");
}

export async function sendEmail(to: string, subject: string, title: string, blocks: Block[], opts: { idempotencyKey?: string; preheader?: string } = {}) {
  // Local development without Resend: write emails to a file instead of sending them.
  if (!process.env.RESEND_API_KEY && process.env.EMAIL_DEV_LOG && process.env.NODE_ENV !== "production") {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.EMAIL_DEV_LOG, JSON.stringify({ to, subject, text: textOf(title, blocks), at: new Date().toISOString() }) + "\n");
    return "dev-log";
  }
  const { data, error } = await resend().emails.send(
    { from: FROM(), to, subject, html: layout(title, blocks, opts.preheader), text: textOf(title, blocks) },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
  if (error) throw new Error(`Resend: ${error.name ?? ""} ${error.message}`);
  return data?.id ?? null;
}

// ---------------- Templates ----------------

export const templates = {
  verifyEmail: (name: string, link: string) =>
    ({
      subject: "Conferma la tua email · Secret Vault",
      title: `Benvenuto, ${name || "ciao"}`,
      blocks: [
        { p: "Grazie per aver scelto Secret Vault, il posto sicuro per le parole che contano." },
        { p: "Conferma il tuo indirizzo email per iniziare:" },
        { button: { label: "Conferma email", href: link } },
        { small: "Il link scade tra 24 ore." },
      ],
    }) satisfies Tpl,

  resetPassword: (link: string) =>
    ({
      subject: "Reimposta la password di accesso · Secret Vault",
      title: "Reimposta la tua password",
      blocks: [
        { p: "Abbiamo ricevuto una richiesta per reimpostare la password di accesso al tuo profilo." },
        { button: { label: "Scegli una nuova password", href: link } },
        { small: "Questa operazione <strong>non</strong> modifica la password della tua cassaforte: i tuoi messaggi restano protetti. Se non sei stato tu, ignora questa email." },
      ],
    }) satisfies Tpl,

  delivery: (o: { recipientName: string; senderName: string; link: string; code?: string; codeBySms?: boolean; codeHint?: string; postMortem: boolean; title?: string }) => {
    const n = esc(o.recipientName || "");
    const s = esc(o.senderName);
    const blocks: Block[] = o.postMortem
      ? [
          { p: `Ciao ${n},` },
          { p: `ci dispiace molto per la perdita di <strong>${s}</strong>. Prima di andarsene, ${s} ha voluto lasciarti un messaggio e ci ha chiesto di custodirlo fino a oggi.` },
          { p: "Prenditi tutto il tempo che ti serve. Il messaggio resterà al sicuro e potrai leggerlo quando te la sentirai." },
        ]
      : [
          { p: `Ciao ${n},` },
          { p: `<strong>${s}</strong> ha scritto qualcosa per te e ha chiesto a Secret Vault di custodirlo fino a questo momento.` },
        ];
    blocks.push({ p: "Per leggerlo, registrati (o accedi) con questo indirizzo email e inserisci il codice di accesso:" });
    blocks.push({ button: { label: "Leggi il messaggio", href: o.link } });
    if (o.code) blocks.push({ code: o.code });
    else if (o.codeBySms) blocks.push({ quote: "Per la tua sicurezza il codice di accesso ti è stato inviato con un SMS separato." });
    else blocks.push({ quote: `${s} ti consegnerà personalmente il codice di accesso.${o.codeHint ? `<br><br><em>“${esc(o.codeHint)}”</em>` : ""}` });
    blocks.push({ small: "Vedrai soltanto ciò che è stato scritto per te. Il messaggio è cifrato: nemmeno noi possiamo leggerlo." });
    return {
      subject: o.postMortem ? `Un messaggio da parte di ${o.senderName}` : `${o.senderName} ha lasciato un messaggio per te`,
      title: o.postMortem ? "Un pensiero custodito per te" : "C'è un messaggio per te",
      blocks,
    } satisfies Tpl;
  },

  executorInvite: (o: { executorName: string; ownerName: string; link: string }) =>
    ({
      subject: `${o.ownerName} ti ha scelto come persona di fiducia`,
      title: "Una richiesta di fiducia",
      blocks: [
        { p: `Ciao ${esc(o.executorName)},` },
        { p: `<strong>${esc(o.ownerName)}</strong> ti ha indicato come <em>persona di fiducia</em> su Secret Vault.` },
        { p: "Il tuo compito sarebbe uno solo: se un giorno dovesse succedergli qualcosa, ti chiederemo di confermarlo con delicatezza, così che i messaggi lasciati alle persone care possano essere consegnati." },
        { quote: "Non vedrai mai i messaggi né a chi sono destinati. Puoi accettare o rinunciare in qualunque momento." },
        { button: { label: "Rispondi all'invito", href: o.link } },
      ],
    }) satisfies Tpl,

  executorCase: (o: { executorName: string; ownerName: string; link: string }) =>
    ({
      subject: `Una richiesta delicata riguardo a ${o.ownerName}`,
      title: "Ti chiediamo una conferma",
      blocks: [
        { p: `Ciao ${esc(o.executorName)},` },
        { p: `non riusciamo più a metterci in contatto con <strong>${esc(o.ownerName)}</strong> da diverso tempo. Ci dispiace doverti scrivere per questo.` },
        { p: `Se ${esc(o.ownerName)} è venuto a mancare, ti chiediamo, se te la senti, di confermarlo. Se invece sta bene, o non ne sei sicuro, indicacelo: non verrà consegnato nulla.` },
        { button: { label: "Rispondi", href: o.link } },
        { small: "Prima di qualsiasi consegna, ci sarà comunque un periodo di attesa durante il quale cercheremo di contattare direttamente la persona interessata." },
      ],
    }) satisfies Tpl,

  checkinReminder: (o: { name: string; link: string; final: boolean }) =>
    ({
      subject: o.final ? "Ultimo promemoria: conferma che stai bene" : "Un saluto da Secret Vault: tutto bene?",
      title: o.final ? "Abbiamo bisogno di un tuo segnale" : "Sei ancora qui?",
      blocks: [
        { p: `Ciao ${esc(o.name)},` },
        { p: "hai attivato il <strong>testamento digitale</strong>: ogni tanto ti chiediamo un piccolo segnale per sapere che va tutto bene." },
        { button: { label: "Sto bene ✓", href: o.link } },
        ...(o.final ? [{ quote: "Se non riceviamo risposta, chiederemo alle tue persone di fiducia di verificare. Nessun messaggio verrà consegnato senza le loro conferme e senza un ulteriore periodo di attesa." }] : []),
      ],
    }) satisfies Tpl,

  caseOpened: (o: { name: string; link: string; contestUntil?: string }) =>
    ({
      subject: "Importante: abbiamo avviato la verifica del tuo testamento digitale",
      title: "Se stai bene, fermaci",
      blocks: [
        { p: `Ciao ${esc(o.name)},` },
        { p: o.contestUntil
            ? `le tue persone di fiducia hanno confermato la tua scomparsa. Se non è così, hai tempo fino al <strong>${esc(o.contestUntil)}</strong> per annullare: dopo, i tuoi messaggi verranno consegnati.`
            : "non abbiamo ricevuto tuoi segnali da tempo e abbiamo chiesto alle tue persone di fiducia di verificare." },
        { button: { label: "Sto bene, annulla tutto", href: o.link } },
      ],
    }) satisfies Tpl,

  deliveryFailed: (o: { name: string; recipient: string; link: string }) =>
    ({
      subject: "Non siamo riusciti a consegnare un messaggio",
      title: "Una consegna non è andata a buon fine",
      blocks: [
        { p: `Ciao ${esc(o.name)},` },
        { p: `dopo diversi tentativi non siamo riusciti a recapitare la notifica a <strong>${esc(o.recipient)}</strong>. Controlla che l'indirizzo sia corretto.` },
        { button: { label: "Apri Secret Vault", href: o.link } },
      ],
    }) satisfies Tpl,

  executorsInformed: (o: { executorName: string; ownerName: string }) =>
    ({
      subject: `I messaggi di ${o.ownerName} stanno per essere consegnati`,
      title: "Grazie per la tua fiducia",
      blocks: [
        { p: `Ciao ${esc(o.executorName)},` },
        { p: `ti scriviamo per dirti che stiamo consegnando i messaggi lasciati da <strong>${esc(o.ownerName)}</strong> alle persone a cui erano destinati. Grazie per averci aiutato in un momento così difficile.` },
      ],
    }) satisfies Tpl,
};

type Tpl = { subject: string; title: string; blocks: Block[] };

export async function sendTemplate(to: string, tpl: Tpl, idempotencyKey?: string) {
  return sendEmail(to, tpl.subject, tpl.title, tpl.blocks, { idempotencyKey });
}
