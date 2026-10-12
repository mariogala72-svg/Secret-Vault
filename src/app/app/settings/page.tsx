"use client";
import { updateProfile } from "firebase/auth";
import { History, KeyRound, LogOut, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordStrength, scorePassword } from "@/components/auth/password-strength";
import { ReauthModal } from "@/components/app/reauth-modal";
import { Button } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { clientAuth } from "@/lib/client/firebase";
import { useVault } from "@/lib/client/vault";
import { rewrapForPassword } from "@/lib/crypto/vault";

const ACTIONS: Record<string, string> = {
  VAULT_CREATED: "Cassaforte creata", VAULT_UNLOCK: "Cassaforte aperta", VAULT_UNLOCK_FAILED: "Tentativo di apertura fallito", VAULT_PASSWORD_CHANGED: "Password della cassaforte cambiata",
  MESSAGE_DRAFT: "Bozza salvata", MESSAGE_SCHEDULED: "Messaggio programmato", MESSAGE_UPDATED: "Messaggio modificato", MESSAGE_DELETED: "Messaggio eliminato", MESSAGE_SEND_NOW: "Invio manuale", MESSAGE_UNSCHEDULED: "Programmazione annullata",
  DELIVERY_SENT: "Messaggio consegnato", DELIVERY_OPENED: "Messaggio letto dal destinatario", DELIVERY_FAILED: "Consegna non riuscita", RECIPIENT_CODE_FAILED: "Codice errato inserito da un destinatario",
  WILL_SETTINGS_UPDATED: "Testamento digitale aggiornato", EXECUTOR_INVITED: "Persona di fiducia invitata", EXECUTOR_ACCEPTED: "Invito accettato", EXECUTOR_DECLINED: "Invito rifiutato", EXECUTOR_REVOKED: "Persona di fiducia rimossa",
  DEATH_CASE_OPENED: "Verifica avviata", DEATH_CASE_CONTEST: "Periodo di attesa iniziato", DEATH_CASE_CANCELLED: "Verifica annullata", EXECUTOR_DECISION: "Risposta di una persona di fiducia", DEATH_CONFIRMED: "Scomparsa confermata",
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, me, refresh, logout } = useAuth();
  const { keys } = useVault();
  const [name, setName] = useState(me?.displayName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [audit, setAudit] = useState<{ id: string; action: string; at: string | null }[] | null>(null);

  useEffect(() => {
    api<{ items: { id: string; action: string; at: string | null }[] }>("/api/audit").then((r) => setAudit(r.items), () => setAudit([]));
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await api("/api/me", { method: "POST", json: { displayName: name.trim() } });
      if (clientAuth().currentUser) await updateProfile(clientAuth().currentUser!, { displayName: name.trim() });
      await refresh();
      toast.success("Nome aggiornato");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  async function changeVaultPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!keys || !user) return toast.error("Apri prima la cassaforte");
    if (pw.a.length < 12 || scorePassword(pw.a) < 3) return toast.error("Scegli una password più robusta");
    if (pw.a !== pw.b) return toast.error("Le due password non coincidono");
    setSavingPw(true);
    try {
      await api("/api/vault", { method: "PUT", json: await rewrapForPassword(user.uid, keys, pw.a) });
      setPw({ a: "", b: "" });
      toast.success("Password della cassaforte aggiornata");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Impostazioni" title="Il tuo profilo" />

      <Card>
        <div className="flex items-center gap-3"><UserRound className="size-5 text-accent" /><h2 className="font-display text-xl">Profilo</h2></div>
        <form onSubmit={saveName} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Nome visibile ai destinatari">{(id) => <Input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
          <Button type="submit" variant="secondary" loading={savingName}>Salva</Button>
        </form>
        <p className="mt-4 text-sm text-muted">Email: <strong className="text-ink">{me?.email}</strong></p>
      </Card>

      <Card>
        <div className="flex items-center gap-3"><KeyRound className="size-5 text-gold" /><h2 className="font-display text-xl">Password della cassaforte</h2></div>
        {keys ? (
          <form onSubmit={changeVaultPassword} className="mt-5 space-y-4">
            <Field label="Nuova password">{(id) => <PasswordInput id={id} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />}</Field>
            <PasswordStrength password={pw.a} />
            <Field label="Ripeti la nuova password">{(id) => <PasswordInput id={id} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />}</Field>
            <p className="text-sm text-muted">La tua chiave di recupero resta valida.</p>
            <Button type="submit" loading={savingPw}>Cambia password</Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">Apri la cassaforte per cambiare la sua password.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3"><History className="size-5 text-accent" /><h2 className="font-display text-xl">Attività recente</h2></div>
        {audit === null ? (
          <div className="skeleton mt-5 h-24 rounded-2xl" />
        ) : audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nessuna attività registrata.</p>
        ) : (
          <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 py-2.5">
                <span>{ACTIONS[a.action] ?? a.action}</span>
                <span className="shrink-0 text-muted">{a.at ? new Date(a.at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-danger/30">
        <div className="flex items-center gap-3"><Trash2 className="size-5 text-danger" /><h2 className="font-display text-xl">Elimina account</h2></div>
        <p className="mt-3 text-sm leading-relaxed text-muted">Cancella in modo definitivo il tuo profilo, la cassaforte e tutti i messaggi, anche quelli già consegnati. Le chiavi vengono distrutte immediatamente: nessuno potrà più leggere nulla.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>Elimina il mio account</Button>
          <Button variant="ghost" onClick={() => logout().then(() => router.replace("/"))}><LogOut className="size-4" /> Esci</Button>
        </div>
      </Card>

      <ReauthModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        danger
        title="Eliminare l'account?"
        confirmLabel="Elimina definitivamente"
        description={<Notice tone="danger">Questa operazione è irreversibile. Tutti i messaggi, programmati e consegnati, saranno cancellati.</Notice>}
        onConfirmed={async () => {
          await api("/api/account", { method: "DELETE" });
          await logout().catch(() => {});
          toast.success("Il tuo account è stato eliminato");
          router.replace("/");
        }}
      />
    </div>
  );
}
