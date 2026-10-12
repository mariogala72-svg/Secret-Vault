import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const ref = (uid: string, id: string) => db().collection("users").doc(uid).collection("contacts").doc(id);

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { enc } = z.object({ enc: z.string().max(10_000) }).parse(await req.json());
  await ref(user.uid, id).set({ enc, updatedAt: FieldValue.serverTimestamp() });
  return ok();
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await ref(user.uid, id).delete();
  return ok();
});
