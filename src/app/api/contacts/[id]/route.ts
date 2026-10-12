import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { HttpError, ok, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Id = z.string().uuid();

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const id = Id.parse((await params).id);
  const { enc } = z.object({ enc: z.string().max(10_000) }).parse(await req.json());
  const r = await sql()`update contacts set enc = ${enc}, updated_at = now() where id = ${id} and user_id = ${user.uid} returning id`;
  if (!r.length) throw new HttpError(404, "Contatto non trovato");
  return ok();
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const id = Id.parse((await params).id);
  await sql()`delete from contacts where id = ${id} and user_id = ${user.uid}`;
  return ok();
});
