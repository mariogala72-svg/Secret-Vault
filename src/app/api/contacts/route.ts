import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { ok, route } from "@/lib/server/http";

export const Contact = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/), enc: z.string().max(10_000) });

const col = (uid: string) => db().collection("users").doc(uid).collection("contacts");

/** Contacts are encrypted in the browser with the vault key: the server stores opaque blobs. */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const s = await col(user.uid).get();
  return ok({ contacts: s.docs.map((d) => ({ id: d.id, enc: d.get("enc") })) });
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { id, enc } = Contact.parse(await req.json());
  await col(user.uid).doc(id).set({ enc, updatedAt: FieldValue.serverTimestamp() });
  return ok({ id }, 201);
});
