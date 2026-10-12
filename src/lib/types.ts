export type TriggerKind = "FIXED_DATE" | "MANUAL_NOW" | "MANUAL_LATER" | "DEATH" | "DATE_OR_DEATH";
export type Occasion = "BIRTHDAY" | "ANNIVERSARY" | "WEDDING" | "COMING_OF_AGE" | "OTHER";

export type Trigger = {
  kind: TriggerKind;
  fireAt?: string | null; // ISO UTC
  occasion?: Occasion | null;
};

export type KeyMode = "SENDER_SHARES_CODE" | "ESCROW_TLOCK" | "ESCROW_SERVER";

export type MessageStatus = "DRAFT" | "SCHEDULED" | "ARMED" | "HOLD" | "DELIVERED" | "PARTIAL" | "FAILED" | "CANCELLED";
export type DeliveryStatus = "DRAFT" | "HOLD" | "WAITING" | "PENDING" | "SENDING" | "SENT" | "OPENED" | "FAILED" | "CANCELLED";

export type AttachmentMeta = {
  id: string;
  encMeta: string; // {name, mime, size}
  size: number; // ciphertext bytes
  chunkCount: number;
};

/** Payload the browser sends to create one delivery. */
export type DeliveryInput = {
  keepId?: string; // keep an existing delivery unchanged (edit)
  contactId: string;
  name: string;
  email: string;
  phone?: string;
  keyMode: KeyMode;
  wrappedDek: string;
  codeSalt: string;
  escrow?: string; // ESCROW_SERVER: the code; ESCROW_TLOCK: armored tlock ciphertext
  codeHint?: string; // SENDER_SHARES_CODE: where the recipient will find the code
};

export type MessageInput = {
  id: string;
  intent: "draft" | "schedule";
  encTitle: string;
  encBody: string;
  ownerWrappedDek: string;
  attachments: AttachmentMeta[];
  trigger: Trigger;
  deliveries: DeliveryInput[];
};

export type DeliveryView = {
  id: string;
  contactId: string;
  name: string;
  emailMasked: string;
  keyMode: KeyMode;
  status: DeliveryStatus;
  dueAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  lastError?: string | null;
};

export type MessageView = {
  id: string;
  status: MessageStatus;
  encTitle: string;
  encBody?: string;
  ownerWrappedDek: string;
  attachments: AttachmentMeta[];
  trigger: Trigger;
  createdAt: string;
  updatedAt: string;
  deliveries: DeliveryView[];
};

export type DeathSwitch = {
  enabled: boolean;
  intervalDays: number;
  graceDays: number;
  quorum: number;
  contestHours: number;
  allowUnattended: boolean;
  lastCheckinAt: string | null;
  nextDueAt: string | null;
};

export type DeathCaseStatus = "AWAITING_EXECUTORS" | "CONTEST" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "NEEDS_REVIEW";
