"use client";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Download, KeyRound, Lock, Printer, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PasswordStrength, scorePassword } from "../auth/password-strength";
import { Button } from "../ui/button";
import { Card, Notice } from "../ui/card";
import { Field, Input, PasswordInput, Textarea } from "../ui/field";
import { Modal } from "../ui/modal";
import { PageLoader } from "../ui/spinner";
import { createVault, isValidRecoveryPhrase, rewrapForPassword, unlockWithPassword, unlockWithRecovery } from "@/lib/crypto/vault";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { clientAuth } from "@/lib/client/firebase";
import { useVault } from "@/lib/client/vault";

/** Renders children only once the vault is unlocked; otherwise shows setup or unlock. */
export function VaultGate({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const { keys } = useVault();
  if (!me) return <PageLoader />;
  if (keys) return <>{children}</>;
  return me.hasVault ? <UnlockVault /> : <SetupVault />;
}

function VaultIcon({ open = false }: { open?: boolean }) {
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative mx-auto grid size-24 place-items-center">
      <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-gold/40" />
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-accent/30 to-gold/30 blur-xl" />
      <div className="relative grid size-16 place-items-center rounded-2xl bg-gradient-brand text-white shadow-xl">
        {open ? <ShieldCheck className="size-7" /> : <Lock className="size-7" />}
      </div>
    </motion.div>
  );
}

function UnlockVault() {
  const { user } = useAuth();
  const { setKeys } = useVault();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const v = await api<{ kdfSalt: string; kdfParams: never; publicKey: string; encPrivateKeyPwd: string }>("/api/vault");
      try {
        const keys = await unlockWithPassword(user.uid, v, pw);
        await api("/api/vault/unlock-result", { method: "POST", json: { ok: true } });
        setPw("");
        setKeys(keys);
      } catch {
        const r = await api<{ remaining: number }>("/api/vault/unlock-result", { method: "POST", json: { ok: false } });
        setError(r.remaining < 5 ? `Password non corretta. Tentativi rimasti prima di una pausa: ${r.remaining}` : "Password non corretta.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <Card className="text-center">
        <VaultIcon />
        <h1 className="mt-6 font-display text-3xl">La tua cassaforte</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">Inserisci la password della cassaforte. È diversa da quella con cui hai fatto l&apos;accesso.</p>
        <form onSubmit={submit} className="mt-7 space-y-4 text-left">
          <Field label="Password della cassaforte">{(id) => <PasswordInput id={id} autoFocus autoComplete="off" required value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>{loading ? "Sto aprendo la cassaforte…" : "Apri"}</Button>
        </form>
        <button onClick={() => setRecoveryOpen(true)} className="mt-5 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Non la ricordi? Usa la chiave di recupero
        </button>
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-left text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          Nemmeno noi possiamo vedere i tuoi messaggi. Per questo non possiamo reimpostare questa password via email.
        </p>
      </Card>
      <RecoveryModal open={recoveryOpen} onClose={() => setRecoveryOpen(false)} />
    </div>
  );
}

function RecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { setKeys } = useVault();
  const [words, setWords] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!isValidRecoveryPhrase(words)) return setError("La chiave di recupero non è valida: controlla le 24 parole");
    if (pw.length < 12 || scorePassword(pw) < 3) return setError("Scegli una password più robusta (almeno 12 caratteri)");
    if (pw !== pw2) return setError("Le due password non coincidono");
    setLoading(true);
    setError(null);
    try {
      const v = await api<{ publicKey: string; encPrivateKeyRecovery: string }>("/api/vault?recovery=1");
      const keys = await unlockWithRecovery(user.uid, v, words);
      await api("/api/vault", { method: "PUT", json: await rewrapForPassword(user.uid, keys, pw) });
      toast.success("Cassaforte recuperata. Hai una nuova password.");
      setKeys(keys);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La chiave di recupero non corrisponde a questa cassaforte");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Recupera la cassaforte">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Chiave di recupero (24 parole)">
          {(id) => <Textarea id={id} rows={4} autoComplete="off" spellCheck={false} placeholder="parola1 parola2 parola3 …" value={words} onChange={(e) => setWords(e.target.value)} />}
        </Field>
        <Field label="Nuova password della cassaforte">{(id) => <PasswordInput id={id} value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
        <PasswordStrength password={pw} />
        <Field label="Ripeti la nuova password">{(id) => <PasswordInput id={id} value={pw2} onChange={(e) => setPw2(e.target.value)} />}</Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>Recupera</Button>
      </form>
    </Modal>
  );
}

function SetupVault() {
  const { user, refresh } = useAuth();
  const { setKeys } = useVault();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof createVault>> | null>(null);
  const [checks, setChecks] = useState<Record<number, string>>({});
  const words = draft?.recoveryWords.split(" ") ?? [];
  const challenge = useMemo(() => {
    if (!draft) return [];
    const idx = new Set<number>();
    const r = crypto.getRandomValues(new Uint32Array(6));
    for (const n of r) if (idx.size < 3) idx.add(n % 24);
    return [...idx].sort((a, b) => a - b);
  }, [draft]);

  async function step1(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    if (pw.length < 12 || scorePassword(pw) < 3) return setError("Usa almeno 12 caratteri: una frase di più parole è perfetta");
    if (pw !== pw2) return setError("Le due password non coincidono");
    setBusy(true);
    setError(null);
    // The vault password must differ from the login one: if it signs us in, it's the same.
    const same = await reauthenticateWithCredential(clientAuth().currentUser!, EmailAuthProvider.credential(user.email, pw)).then(() => true, () => false);
    if (same) {
      setBusy(false);
      return setError("Usa una password diversa da quella di accesso al profilo");
    }
    setDraft(await createVault(user.uid, pw));
    setBusy(false);
    setStep(2);
  }

  function download() {
    const text = `SECRET VAULT — CHIAVE DI RECUPERO\n\nAccount: ${user?.email}\nCreata il: ${new Date().toLocaleDateString("it-IT")}\n\n${words.map((w, i) => `${String(i + 1).padStart(2, " ")}. ${w}`).join("\n")}\n\nConservala in un luogo sicuro e privato. Chi la possiede può aprire la tua cassaforte.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "secret-vault-chiave-di-recupero.txt" });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const wrong = challenge.some((i) => (checks[i] ?? "").trim().toLowerCase() !== words[i]);
    if (wrong) return setError("Le parole non corrispondono. Controlla la tua copia.");
    setBusy(true);
    try {
      await api("/api/vault", { method: "POST", json: draft.record });
      setKeys(draft.unlocked);
      await refresh();
      toast.success("La tua cassaforte è pronta");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-10">
      <Card>
        <div className="mb-6 flex items-center gap-2" aria-label={`Passo ${step} di 3`}>
          {[1, 2, 3].map((s) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-gradient-brand" : "bg-line"}`} />
          ))}
        </div>
        {step === 1 && (
          <form onSubmit={step1} className="space-y-5">
            <VaultIcon />
            <div className="text-center">
              <h1 className="font-display text-3xl">Crea la tua cassaforte</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">Scegli una seconda password, diversa da quella di accesso. Sarà la chiave che cifra i tuoi messaggi: non la conosceremo mai.</p>
            </div>
            <Field label="Password della cassaforte" hint="Consiglio: una frase che solo tu conosci, ad esempio “il gatto Pippo ama la pioggia di aprile”.">
              {(id) => (
                <>
                  <PasswordInput id={id} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
                  <PasswordStrength password={pw} />
                </>
              )}
            </Field>
            <Field label="Ripeti la password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}</Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy}>{busy ? "Genero le chiavi…" : "Continua"}</Button>
          </form>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-soft text-gold"><KeyRound className="size-6" /></div>
              <h1 className="mt-4 font-display text-3xl">La tua chiave di recupero</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">Se dimentichi la password della cassaforte, queste 24 parole sono l&apos;unico modo per riaprirla. Scrivile su carta o stampale, e conservale con i tuoi documenti importanti.</p>
            </div>
            <ol className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface-solid/50 p-4 sm:grid-cols-3 print:grid-cols-3">
              {words.map((w, i) => (
                <li key={i} className="flex items-baseline gap-2 rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">
                  <span className="w-5 text-right text-xs text-faint">{i + 1}</span>
                  {w}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={download}><Download className="size-4" /> Scarica</Button>
              <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Stampa</Button>
            </div>
            <Notice tone="warning">Non salvarla in email o in chat. Chiunque la possieda può aprire la tua cassaforte.</Notice>
            <Button className="w-full" size="lg" onClick={() => { setError(null); setStep(3); }}>L&apos;ho conservata</Button>
          </div>
        )}
        {step === 3 && (
          <form onSubmit={finish} className="space-y-5">
            <div className="text-center">
              <h1 className="font-display text-3xl">Verifichiamo insieme</h1>
              <p className="mt-2 text-[15px] text-muted">Inserisci queste parole della tua chiave di recupero.</p>
            </div>
            {challenge.map((i) => (
              <Field key={i} label={`Parola n. ${i + 1}`}>
                {(id) => <Input id={id} autoComplete="off" spellCheck={false} value={checks[i] ?? ""} onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.value }))} />}
              </Field>
            ))}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>Indietro</Button>
              <Button type="submit" className="flex-1" size="lg" loading={busy}>Crea la cassaforte</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
