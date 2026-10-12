import { destroySession } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  await destroySession(req);
  return ok();
});
