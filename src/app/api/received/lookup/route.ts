import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";
import { sha256 } from "@/lib/server/seal";

/** Public: from the link token, shows who wrote and which address it was sent to (masked). */
export const GET = route(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token.length < 20 || token.length > 100) throw new HttpError(404, "Link non valido");
  const s = await db().collection("deliveries").where("linkTokenHash", "==", sha256(token)).limit(1).get();
  const d = s.docs[0];
  if (!d || !["SENT", "OPENED"].includes(d.get("status"))) throw new HttpError(404, "Link non valido o scaduto");
  const owner = await db().collection("users").doc(d.get("ownerUid")).get();
  return ok({ senderName: owner.get("displayName"), emailMasked: d.get("emailMasked"), postMortem: owner.get("status") === "DECEASED" });
});
