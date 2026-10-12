import { requireUser } from "@/lib/server/auth";
import { canReadMessage } from "@/lib/server/access";
import { db } from "@/lib/server/firebase";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ aid: string; n: string }> };
const ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_CHUNK = 600 * 1024; // encrypted chunk of 512 KiB + envelope

async function parse(ctx: Ctx) {
  const { aid, n } = await ctx.params;
  const idx = Number(n);
  if (!ID.test(aid) || !Number.isInteger(idx) || idx < 0 || idx > 63) throw new HttpError(400, "Richiesta non valida");
  return { aid, idx, ref: db().collection("chunks").doc(`${aid}_${idx}`) };
}

/** Uploads one encrypted chunk (already encrypted in the browser). */
export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { aid, idx, ref } = await parse(ctx);
  const messageId = new URL(req.url).searchParams.get("messageId") ?? "";
  if (!ID.test(messageId)) throw new HttpError(400, "Richiesta non valida");
  const data = Buffer.from(await req.arrayBuffer());
  if (data.length === 0 || data.length > MAX_CHUNK) throw new HttpError(413, "Blocco troppo grande");

  const msg = await db().collection("messages").doc(messageId).get();
  if (msg.exists && msg.get("ownerUid") !== user.uid) throw new HttpError(403, "Non autorizzato");
  await db().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && existing.get("ownerUid") !== user.uid) throw new HttpError(403, "Non autorizzato");
    tx.set(ref, { ownerUid: user.uid, messageId, aid, n: idx, data, createdAt: new Date() });
  });
  return ok({}, 201);
});

export const GET = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { ref } = await parse(ctx);
  const snap = await ref.get();
  if (!snap.exists || !(await canReadMessage(user, snap.get("messageId")))) throw new HttpError(404, "Allegato non trovato");
  const data = snap.get("data") as Buffer;
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
});
