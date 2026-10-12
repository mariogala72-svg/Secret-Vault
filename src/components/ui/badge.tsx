import { cn } from "./cn";
import type { DeliveryStatus, MessageStatus } from "@/lib/types";

const tones = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent/12 text-accent border-accent/25",
  gold: "bg-gold-soft text-gold border-gold/30",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

const MSG: Record<MessageStatus, [string, keyof typeof tones]> = {
  DRAFT: ["Bozza", "neutral"],
  SCHEDULED: ["Programmato", "accent"],
  ARMED: ["Testamento digitale", "gold"],
  HOLD: ["In attesa del tuo invio", "neutral"],
  DELIVERED: ["Consegnato", "success"],
  PARTIAL: ["Consegnato in parte", "warning"],
  FAILED: ["Consegna non riuscita", "danger"],
  CANCELLED: ["Annullato", "neutral"],
};

const DEL: Record<DeliveryStatus, [string, keyof typeof tones]> = {
  DRAFT: ["Bozza", "neutral"],
  HOLD: ["In attesa", "neutral"],
  WAITING: ["Custodito", "gold"],
  PENDING: ["Programmato", "accent"],
  SENDING: ["In invio", "accent"],
  SENT: ["Consegnato", "success"],
  OPENED: ["Letto", "success"],
  FAILED: ["Non riuscito", "danger"],
  CANCELLED: ["Annullato", "neutral"],
};

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const [label, tone] = MSG[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const [label, tone] = DEL[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}
