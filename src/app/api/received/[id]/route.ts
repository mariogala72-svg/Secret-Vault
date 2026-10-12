import { assertNotCodeLocked, getReceivedDelivery } from "@/lib/server/access";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { iso, ok, route } from "@/lib/server/http";
import { openStr } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const d = await getReceivedDelivery(user, (await params).id);
  assertNotCodeLocked(d);
  const [[m], [owner]] = await Promise.all([
    sql()`select * from messages where id = ${d.message_id}`,
    sql()`select display_name, status from users where id = ${d.owner_id}`,
  ]);
  return ok({
    id: d.id,
    messageId: m.id,
    senderName: owner.display_name,
    postMortem: owner.status === "DECEASED",
    writtenAt: iso(m.created_at),
    sentAt: iso(d.sent_at),
    openedAt: iso(d.opened_at),
    keyMode: d.key_mode,
    codeHint: d.code_hint_sealed ? openStr(d.code_hint_sealed as string) : null,
    canResendCode: !!d.code_reserve_sealed,
    wrappedDek: d.wrapped_dek,
    codeSalt: d.code_salt,
    encTitle: m.enc_title,
    encBody: m.enc_body,
    attachments: m.attachments ?? [],
  });
});
