import { ArrowRight, CalendarHeart, Check, Eye, Fingerprint, HeartHandshake, KeyRound, Lock, Mail, PenLine, Send, ShieldCheck, Sparkles, Timer, Users } from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { SiteNav } from "@/components/marketing/site-nav";
import { Aurora } from "@/components/ui/aurora";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const steps = [
  { icon: PenLine, title: "Scrivi", text: "Una lettera, un ricordo, un segreto. Aggiungi foto e documenti. Tutto viene cifrato direttamente sul tuo dispositivo." },
  { icon: Users, title: "Scegli a chi", text: "Indica una o più persone care. Riceveranno un invito delicato e un codice personale per aprire il messaggio." },
  { icon: CalendarHeart, title: "Decidi quando", text: "In una data speciale, quando lo vorrai tu, oppure quando non ci sarai più. Noi lo custodiamo fino a quel momento." },
];

const occasions = [
  { emoji: "🎂", title: "Compleanni e traguardi", text: "I 18 anni di un figlio, una laurea, il primo giorno di lavoro." },
  { emoji: "💍", title: "Matrimoni e anniversari", text: "Parole scritte oggi, lette nel giorno più importante." },
  { emoji: "🕊️", title: "Quando non ci sarò più", text: "Un ultimo abbraccio, istruzioni pratiche, ciò che non hai mai detto." },
  { emoji: "🔑", title: "Segreti da custodire", text: "Ciò che deve restare chiuso, fino al momento giusto." },
];

const security = [
  { icon: Lock, title: "Cifratura end-to-end", text: "AES-256-GCM con chiavi derivate da Argon2id. I contenuti lasciano il tuo dispositivo già cifrati." },
  { icon: KeyRound, title: "Doppia password, davvero", text: "La password della cassaforte non arriva mai ai nostri server: è la chiave stessa. Chi entra nel profilo non vede nulla." },
  { icon: Timer, title: "Sigillo a tempo", text: "Per le date fisse il codice è sigillato con la rete drand: nessuno, nemmeno noi, può aprirlo prima del giorno scelto." },
  { icon: Eye, title: "Nessun admin può leggere", text: "Non conserviamo password né chiavi in chiaro. Un furto del database restituirebbe solo dati illeggibili." },
  { icon: Fingerprint, title: "Accesso isolato", text: "Il destinatario vede solo ciò che è stato scritto per lui: nient'altro del tuo profilo." },
  { icon: ShieldCheck, title: "Pensato per il GDPR", text: "Dati in Europa, diritto all'oblio con cancellazione crittografica, nessun tracciamento pubblicitario." },
];

const faqs = [
  { q: "Cosa succede se dimentico la password della cassaforte?", a: "Alla creazione della cassaforte ricevi una chiave di recupero di 24 parole. È l'unico modo per riaprirla: noi non possiamo, perché non conosciamo la tua password." },
  { q: "Come fate a sapere che non ci sono più?", a: "Ti chiediamo periodicamente un piccolo segnale. Se non rispondi, contattiamo le persone di fiducia che hai scelto. Solo dopo la loro conferma, e un ulteriore periodo di attesa in cui puoi sempre annullare, i messaggi vengono consegnati." },
  { q: "Il destinatario deve registrarsi?", a: "Sì, con l'indirizzo email a cui ha ricevuto l'invito. In questo modo solo lui può aprire il messaggio, inserendo il suo codice personale." },
  { q: "Un messaggio ha valore di testamento?", a: "No. Secret Vault custodisce parole e ricordi, ma non sostituisce un testamento legale. Per le disposizioni sui beni rivolgiti a un notaio: puoi però indicare nel messaggio dove trovarlo." },
  { q: "Posso modificare o annullare un messaggio?", a: "Sempre, finché non è stato consegnato. Ti ricordiamo anche dei messaggi in programma, così potrai rileggerli." },
];

export default function Home() {
  return (
    <div className="relative px-4">
      <Aurora />
      <SiteNav />

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
        <div>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted">
            <Sparkles className="size-3.5 text-gold" /> Cifrato end-to-end · Dati in Europa
          </span>
          <h1 className="mt-6 font-display text-[2.75rem] font-medium leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Le parole che contano,
            <br />
            <span className="text-gradient italic">al momento giusto.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Scrivi messaggi segreti, custoditi in una cassaforte che solo tu puoi aprire. Consegnali alle persone che ami in una data speciale, o quando non ci sarai più.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">
              Crea la tua cassaforte <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/ricevuto" variant="secondary" size="lg">
              <Mail className="size-4" /> Ho ricevuto un messaggio
            </ButtonLink>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {["Gratuito per iniziare", "Nessuno può leggere i tuoi messaggi", "Annulli quando vuoi"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-success" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </section>

      {/* HOW */}
      <section id="come-funziona" className="mx-auto max-w-6xl scroll-mt-28 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Come funziona</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-medium tracking-tight sm:text-5xl">Tre passi, con calma.</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="glass group relative overflow-hidden rounded-3xl p-7">
              <span className="absolute right-6 top-4 font-display text-7xl text-line-strong/60 transition group-hover:text-accent/20">{i + 1}</span>
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-brand text-white shadow-lg">
                <s.icon className="size-5" />
              </div>
              <h3 className="mt-6 font-display text-2xl">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OCCASIONS */}
      <section className="mx-auto max-w-6xl py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {occasions.map((o) => (
            <div key={o.title} className="rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-1 hover:border-line-strong">
              <div className="text-3xl">{o.emoji}</div>
              <h3 className="mt-4 font-medium">{o.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIGITAL WILL */}
      <section id="testamento" className="mx-auto max-w-6xl scroll-mt-28 py-20">
        <div className="glass relative overflow-hidden rounded-[36px] p-8 sm:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Testamento digitale</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Quando non ci sarai, <span className="italic text-gradient">le tue parole sì.</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Un sistema pensato per non sbagliare mai: nessun segnale da solo può sbloccare i tuoi messaggi. Servono il silenzio prolungato, la conferma delle persone di cui ti fidi e un tempo di attesa in cui puoi sempre fermare tutto.
              </p>
              <ButtonLink href="/register" variant="gold" className="mt-8">
                <HeartHandshake className="size-4" /> Configura il tuo testamento digitale
              </ButtonLink>
            </div>
            <ol className="space-y-4">
              {[
                ["Un segnale ogni tanto", "Ogni 30–365 giorni ti chiediamo un clic: “sto bene”. Anche un accesso conta."],
                ["Le persone di fiducia", "Se non rispondi per settimane, chiediamo conferma a chi hai scelto tu. Non vedranno mai i tuoi messaggi."],
                ["Tempo per ripensarci", "Raggiunte le conferme, attendiamo ancora (da 24 ore a 14 giorni) cercandoti su tutti i canali."],
                ["La consegna", "Solo allora i destinatari ricevono un invito delicato, mai di notte."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4 rounded-2xl border border-line bg-surface-solid/40 p-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-soft font-display text-gold">{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="sicurezza" className="mx-auto max-w-6xl scroll-mt-28 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Sicurezza</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl font-medium tracking-tight sm:text-5xl">Una cassaforte che nemmeno noi possiamo aprire.</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {security.map((s) => (
            <div key={s.title} className="rounded-3xl border border-line bg-surface p-7">
              <s.icon className="size-6 text-accent" />
              <h3 className="mt-5 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-28 py-20">
        <h2 className="text-center font-display text-4xl font-medium tracking-tight">Domande frequenti</h2>
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group glass rounded-2xl p-5 open:pb-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl py-16">
        <div className="bg-gradient-brand relative overflow-hidden rounded-[36px] px-8 py-16 text-center text-white sm:px-16">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_40%)]" />
          <h2 className="relative font-display text-4xl font-medium tracking-tight sm:text-5xl">C&apos;è qualcosa che vorresti dire?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/85">Inizia oggi. Bastano pochi minuti, e potrai sempre tornare a modificarlo.</p>
          <ButtonLink href="/register" variant="secondary" size="lg" className="relative mt-8 !bg-white !text-[#2a1f5c]">
            <Send className="size-4" /> Scrivi il tuo primo messaggio
          </ButtonLink>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line py-10 text-sm text-muted sm:flex-row">
        <Logo />
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/ricevuto" className="hover:text-ink">Ho ricevuto un messaggio</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/termini" className="hover:text-ink">Termini</Link>
        </div>
        <p>© {new Date().getFullYear()} Secret Vault</p>
      </footer>
    </div>
  );
}
