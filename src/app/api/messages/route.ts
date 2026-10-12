import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { initialStatuses, sweepDueDeliveries } from "@/lib/server/engine";
import { HttpError, ok, route } from "@/lib/server/http";
import { assertChunksUploaded, assertTriggerAllowed, deliveryRow, MessageSchema, messageView, triggerJson } from "@/lib/server/messages";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [ms, ds] = await Promise.all([
    sql()`select id, status, enc_title, owner_wrapped_dek, attachments, trigger, created_at, updated_at from messages where owner_id = ${user.uid} order by updated_at desc`,
    sql()`select * from deliveries where owner_id = ${user.uid} order by created_at`,
  ]);
  const byMsg = Map.groupBy(ds, (d) => d.message_id as string);
  return ok({ messages: ms.map((m) => messageView(m, byMsg.get(m.id) ?? [])) });
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const input = MessageSchema.parse(await req.json());
  if (input.deliveries.some((d) => d.keepId)) throw new HttpError(400, "Richiesta non valida");
  await assertTriggerAllowed(user.uid, input);
  await assertChunksUploaded(user.uid, input.id, input.attachments);

  const st = initialStatuses(input.trigger, input.intent);
  await sql().begin(async (tx) => {
    const [m] = await tx`
      insert into messages (id, owner_id, status, enc_title, enc_body, owner_wrapped_dek, attachments, trigger)
      values (${input.id}, ${user.uid}, ${st.message}, ${input.encTitle}, ${input.encBody}, ${input.ownerWrappedDek},
        ${tx.json(input.attachments)}, ${tx.json(triggerJson(input.trigger))})
      on conflict (id) do nothing returning id`;
    if (!m) throw new HttpError(409, "Messaggio già esistente");
    for (const d of input.deliveries) await tx`insert into deliveries ${tx(deliveryRow(user.uid, input.id, d, st))}`;
  });
  await audit(user.uid, input.intent === "draft" ? "MESSAGE_DRAFT" : "MESSAGE_SCHEDULED", { messageId: input.id, trigger: input.trigger.kind });
  if (input.intent === "schedule" && input.trigger.kind === "MANUAL_NOW") await sweepDueDeliveries();
  return ok({ id: input.id, status: st.message }, 201);
});
