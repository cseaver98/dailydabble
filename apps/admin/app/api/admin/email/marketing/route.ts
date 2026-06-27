import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

type MarketingRecipientRow = {
  user_id: string;
  email: string;
};

const PAGE_SIZE = 200;
const SEND_BATCH_SIZE = 25;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dailydabble.app";
  return appUrl.replace(/\/+$/, "");
};

const getUnsubscribeSecret = () => process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

const createUnsubscribeToken = (userId: string, preference: "marketing") => {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    throw new Error("Missing EMAIL_UNSUBSCRIBE_SECRET or CRON_SECRET");
  }

  const payload = Buffer.from(JSON.stringify({ userId, preference }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeBody = (body: string): string[] =>
  body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const buildMarketingEmail = ({
  subject,
  body,
  userId,
  unsubscribeUrlOverride,
}: {
  subject: string;
  body: string;
  userId: string;
  unsubscribeUrlOverride?: string;
}) => {
  const appUrl = getAppUrl();
  const accountUrl = `${appUrl}/account`;
  const unsubscribeUrl =
    unsubscribeUrlOverride ||
    `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId, "marketing"))}`;
  const paragraphs = normalizeBody(body);
  const text = [
    subject,
    "",
    body.trim(),
    "",
    "You received this email because product updates and launch news are turned on for your DailyDabble account.",
    "unsubscribe:",
    unsubscribeUrl,
    "",
    "Manage email preferences:",
    accountUrl,
  ].join("\n");
  const paragraphHtml = paragraphs
    .map((paragraph, index) => {
      const margin = index === 0 ? "16px 0 0" : "10px 0 0";
      return `<p style="margin: ${margin}; color: #595c5e; font-size: 15px; line-height: 1.6; font-weight: 600;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`;
    })
    .join("");

  return {
    text,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${escapeHtml(subject)}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;900&family=Plus+Jakarta+Sans:wght@900&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; background: #f5f6f9; color: #2c2f31; font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; background: #f5f6f9;">
            <tr>
              <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 520px; border-collapse: collapse;">
                  <tr>
                    <td style="border: 1px solid #d8dce2; border-radius: 20px; background: #ffffff; padding: 28px; box-shadow: 0 18px 44px rgba(44, 47, 49, 0.12);">
                      <img src="https://dailydabble.app/dailydabble-logo-email.png" width="220" height="47" alt="DailyDabble" style="display: block; width: 220px; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none;">
                      ${paragraphHtml}
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0 0; border-collapse: collapse;">
                        <tr>
                          <td>
                            <a href="${appUrl}" style="display: inline-block; border-radius: 999px; background: #2c2f31; color: #ffffff; padding: 13px 22px; font-size: 15px; line-height: 1; font-weight: 900; text-decoration: none;">
                              Open DailyDabble
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 8px 0; text-align: center; color: #75777a; font-size: 12px; line-height: 1.5;">
                      You received this email because product updates and launch news are turned on for your DailyDabble account.
                      <a href="${unsubscribeUrl}" style="color: #75777a; text-decoration: underline;">unsubscribe</a>
                      or manage email preferences from <a href="${accountUrl}" style="color: #75777a; text-decoration: underline;">your account settings</a>.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
};

const buildPreviewEmail = ({ subject, body }: { subject: string; body: string }) =>
  buildMarketingEmail({
    subject,
    body,
    userId: "00000000-0000-0000-0000-000000000000",
    unsubscribeUrlOverride: `${getAppUrl()}/api/email/unsubscribe?token=preview`,
  });

const getSupabaseAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const getMarketingRecipients = async () => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema("core")
    .rpc("get_marketing_email_recipients")
    .returns<MarketingRecipientRow[]>();

  if (error) {
    throw new Error(`Failed to load marketing recipients: ${error.message}`);
  }

  const recipients = (data ?? []) as MarketingRecipientRow[];
  return recipients.map((row) => ({ userId: row.user_id, email: row.email }));
};

export async function GET() {
  try {
    const recipients = await getMarketingRecipients();
    const sampleEmails = recipients.slice(0, 5).map((recipient) => recipient.email);

    return NextResponse.json({ ok: true, optedInProfiles: recipients.length, recipients: recipients.length, sampleEmails });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load marketing recipients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();
    const dryRun = Boolean(payload.dryRun);
    const preview = Boolean(payload.preview);

    if (subject.length < 4 || subject.length > 120) {
      return NextResponse.json({ error: "Subject must be between 4 and 120 characters." }, { status: 400 });
    }
    if (body.length < 10 || body.length > 5000) {
      return NextResponse.json({ error: "Body must be between 10 and 5000 characters." }, { status: 400 });
    }

    if (preview) {
      const email = buildPreviewEmail({ subject, body });
      return NextResponse.json({ ok: true, preview: true, subject, text: email.text, html: email.html });
    }

    const recipients = await getMarketingRecipients();

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        recipients: recipients.length,
        skipped: 0,
        sampleEmails: recipients.slice(0, 5).map((recipient) => recipient.email),
      });
    }

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: "Real email sends are disabled locally. Use staging to test delivery." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MARKETING_EMAIL_FROM;
    if (!apiKey || !from) {
      return NextResponse.json({ error: "Marketing email is not configured." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const sent: string[] = [];
    const failures: Array<{ userId: string; email: string; error: string }> = [];

    for (const batch of chunk(recipients, SEND_BATCH_SIZE)) {
      await Promise.all(
        batch.map(async (recipient) => {
          const email = buildMarketingEmail({ subject, body, userId: recipient.userId });
          const { error } = await resend.emails.send({
            from,
            to: recipient.email,
            subject,
            text: email.text,
            html: email.html,
            tags: [{ name: "type", value: "marketing" }],
          });

          if (error) {
            failures.push({ userId: recipient.userId, email: recipient.email, error: error.message });
            return;
          }
          sent.push(recipient.userId);
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      recipients: recipients.length,
      sent: sent.length,
      skipped: 0,
      failed: failures.length,
      failures: failures.slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send marketing email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
