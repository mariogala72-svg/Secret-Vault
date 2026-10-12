import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { ok, route } from "@/lib/server/http";

const Body = z.object({ ok: z.boolean() });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { ok: success } = Body.parse(await req.json());
  const ref = db().collection("vaults").doc(user.uid);
  if (success) {
    await ref.update({ failedUnlocks: 0, lockedUntil: null });
    await audit(user.uid, "VAULT_UNLOCK");
    return ok();
  }
  const failed = await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const n = (s.get("failedUnlocks") ?? 0) + 1;
    const update: Record<string, unknown> = { failedUnlocks: FieldValue.increment(1) };
    if (n % 5 === 0) update.lockedUntil = Timestamp.fromMillis(Date.now() + 15 * 60_000 * 2 ** (n / 5 - 1));
    tx.update(ref, update);
    return n;
  });
  await audit(user.uid, "VAULT_UNLOCK_FAILED", { attempt: failed });
  return ok({ remaining: 5 - (failed % 5) });
});
