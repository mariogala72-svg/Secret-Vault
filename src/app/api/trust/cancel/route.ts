import { requireRecentLogin, requireUser } from "@/lib/server/auth";
import { cancelOpenCase } from "@/lib/server/engine";
import { ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  requireRecentLogin(user);
  await cancelOpenCase(user.uid, "OWNER");
  return ok();
});
