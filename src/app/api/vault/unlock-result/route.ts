import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { ok, route } from "@/lib/server/http";

const Body = z.object({ ok: z.boolean() });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { ok: success } = Body.parse(await req.json());
  if (success) {
    await sql()`update vaults set failed_unlocks = 0, locked_until = null where user_id = ${user.uid}`;
    await audit(user.uid, "VAULT_UNLOCK");
    return ok();
  }
  // Every 5 failures: 15 minutes lock, doubling each time.
  const [v] = await sql()`
    update vaults set failed_unlocks = failed_unlocks + 1,
      locked_until = case when (failed_unlocks + 1) % 5 = 0
        then now() + make_interval(mins => (15 * power(2, (failed_unlocks + 1) / 5 - 1))::int) else locked_until end
    where user_id = ${user.uid} returning failed_unlocks`;
  await audit(user.uid, "VAULT_UNLOCK_FAILED", { attempt: v.failed_unlocks });
  return ok({ remaining: 5 - (v.failed_unlocks % 5) });
});
