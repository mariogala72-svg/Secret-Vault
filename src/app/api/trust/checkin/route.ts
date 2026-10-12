import { requireUser } from "@/lib/server/auth";
import { checkIn } from "@/lib/server/engine";
import { ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  await checkIn(user.uid);
  return ok();
});
