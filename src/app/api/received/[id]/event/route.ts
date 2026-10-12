import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getReceivedDelivery } from "@/lib/server/access";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { esc, sendEmail } from "@/lib/server/email";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { openStr } from "@/lib/server/seal";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ type: z.enum(["code-failed", "opened", "resend-code"]) });

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { type } = Body.parse(await req.json());
  const d = await getReceivedDelivery(user, (await params).id);

  if (type === "code-failed") {
    const n = (d.get("failedCodeAttempts") ?? 0) + 1;
    if (n >= 5) await d.ref.update({ failedCodeAttempts: 0, codeLockedUntil: Timestamp.fromMillis(Date.now() + 86_400_000) });
    else await d.ref.update({ failedCodeAttempts: n });
    await audit(d.get("ownerUid"), "RECIPIENT_CODE_FAILED", { deliveryId: d.id });
    return ok({ remaining: n >= 5 ? 0 : 5 - n });
  }

  if (type === "opened") {
    if (!d.get("openedAt")) {
      await d.ref.update({ status: "OPENED", openedAt: FieldValue.serverTimestamp(), redeemedBy: user.uid, failedCodeAttempts: 0 });
      await audit(d.get("ownerUid"), "DELIVERY_OPENED", { deliveryId: d.id });
    }
    return ok();
  }

  // resend-code: only while the reserve exists, at most every 10 minutes, to the original address.
  if (!d.get("codeReserveSealed")) throw new HttpError(409, "Il codice non è più disponibile");
  const last = d.get("codeResentAt")?.toMillis?.() ?? 0;
  if (Date.now() - last < 10 * 60_000) throw new HttpError(429, "Ti abbiamo già inviato il codice da poco, controlla la tua email");
  const owner = await db().collection("users").doc(d.get("ownerUid")).get();
  await sendEmail(openStr(d.get("sealedEmail")), "Il tuo codice di accesso · Secret Vault", "Ecco il tuo codice", [
    { p: `Questo è il codice per aprire il messaggio di <strong>${esc(owner.get("displayName") ?? "")}</strong>:` },
    { code: openStr(d.get("codeReserveSealed"), "escrow") },
  ]);
  await d.ref.update({ codeResentAt: FieldValue.serverTimestamp() });
  return ok();
});
