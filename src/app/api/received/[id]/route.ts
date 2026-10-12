import { assertNotCodeLocked, getReceivedDelivery } from "@/lib/server/access";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { iso, ok, route } from "@/lib/server/http";
import { openStr } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const d = await getReceivedDelivery(user, (await params).id);
  assertNotCodeLocked(d);
  const [m, owner] = await Promise.all([
    db().collection("messages").doc(d.get("messageId")).get(),
    db().collection("users").doc(d.get("ownerUid")).get(),
  ]);
  return ok({
    id: d.id,
    messageId: m.id,
    senderName: owner.get("displayName"),
    postMortem: owner.get("status") === "DECEASED",
    writtenAt: iso(m.get("createdAt")),
    sentAt: iso(d.get("sentAt")),
    openedAt: iso(d.get("openedAt")),
    keyMode: d.get("keyMode"),
    codeHint: d.get("codeHintSealed") ? openStr(d.get("codeHintSealed")) : null,
    canResendCode: !!d.get("codeReserveSealed"),
    wrappedDek: d.get("wrappedDek"),
    codeSalt: d.get("codeSalt"),
    encTitle: m.get("encTitle"),
    encBody: m.get("encBody"),
    attachments: m.get("attachments") ?? [],
  });
});
