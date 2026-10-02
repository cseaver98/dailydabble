import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

type UnsubscribePreference = "daily_reminder" | "marketing";

type UnsubscribePayload = {
  userId?: string;
  preference?: UnsubscribePreference;
};

const getUnsubscribeSecret = () => process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

const reply = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

const safeEqual = (a: string, b: string) => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
};

const parseToken = (token: string): UnsubscribePayload | null => {
  const secret = getUnsubscribeSecret();
  const [payload, signature] = token.split(".");
  if (!secret || !payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UnsubscribePayload;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const payload = parseToken(token);

  if (!payload?.userId || !payload.preference) {
    return reply("This unsubscribe link is invalid.", 400);
  }

  const updatePayload =
    payload.preference === "daily_reminder"
      ? { daily_reminder_opt_in: false, daily_reminder_opted_in_at: null, updated_at: new Date().toISOString() }
      : payload.preference === "marketing"
        ? { marketing_email_opt_in: false, updated_at: new Date().toISOString() }
        : null;

  if (!updatePayload) {
    return reply("This unsubscribe link is invalid.", 400);
  }

  const { error } = await getSupabaseAdmin()
    .schema("core")
    .from("profiles")
    .update(updatePayload)
    .eq("id", payload.userId);

  if (error) {
    return reply("Could not update your email preference. Please try again later.", 500);
  }

  return reply("You have been unsubscribed.", 200);
}
