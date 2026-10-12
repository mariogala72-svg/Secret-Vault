import "server-only";
import { z } from "zod";
import type { AuthedUser } from "./auth";
import { sql, type Row } from "./db";
import { HttpError } from "./http";
import { emailIndex } from "./seal";

/** A recipient sees a delivery only once released, and only with the verified email it was addressed to. */
export async function getReceivedDelivery(user: AuthedUser, deliveryId: string): Promise<Row> {
  if (!z.string().uuid().safeParse(deliveryId).success) throw new HttpError(404, "Messaggio non trovato");
  const [d] = await sql()`
    select * from deliveries
    where id = ${deliveryId} and status in ('SENT', 'OPENED')
      and (redeemed_by = ${user.uid} or email_idx = ${emailIndex(user.email)})`;
  if (!d) throw new HttpError(404, "Messaggio non trovato");
  return d;
}

export function assertNotCodeLocked(d: Row) {
  if (d.code_locked_until && new Date(d.code_locked_until as string).getTime() > Date.now()) {
    throw new HttpError(429, "Troppi tentativi con un codice errato. Riprova domani.", "CODE_LOCKED");
  }
}

export async function canReadMessage(user: AuthedUser, messageId: string): Promise<boolean> {
  const [r] = await sql()`
    select 1 from messages m where m.id = ${messageId} and m.owner_id = ${user.uid}
    union all
    select 1 from deliveries d
    where d.message_id = ${messageId} and d.email_idx = ${emailIndex(user.email)}
      and d.status in ('SENT', 'OPENED') and (d.code_locked_until is null or d.code_locked_until < now())
    limit 1`;
  return !!r;
}
