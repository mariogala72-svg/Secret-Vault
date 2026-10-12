import { z } from "zod";
import { sendTemplate, templates } from "@/lib/server/email";
import { adminAuth } from "@/lib/server/firebase";
import { appUrl, ok, route } from "@/lib/server/http";

const Body = z.object({ email: z.string().email().max(200) });

// Always answers the same way, so it cannot be used to discover registered emails.
export const POST = route(async (req) => {
  const { email } = Body.parse(await req.json());
  try {
    const link = await adminAuth().generatePasswordResetLink(email.trim().toLowerCase(), { url: `${appUrl(req)}/login` });
    await sendTemplate(email, templates.resetPassword(link));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== "auth/user-not-found" && code !== "auth/email-not-found") console.error("[reset]", e);
  }
  return ok();
});
