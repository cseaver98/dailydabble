import { dailyGames } from "@/lib/games";
import { scheduleTodayGames } from "@/lib/daily-game-scheduler";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

type ReminderProfileRow = {
  id: string;
};

type PlayedRow = {
  user_id: string;
};

const PAGE_SIZE = 200;
const SEND_BATCH_SIZE = 25;

const isAuthorized = (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
};

const getHourInTimeZone = (timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  const hour = Number(formatter.format(new Date()));
  return Number.isFinite(hour) ? hour : null;
};

const getAppUrl = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dailydabble.app";
  return appUrl.replace(/\/+$/, "");
};

const getUnsubscribeSecret = () => process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";

const createUnsubscribeToken = (userId: string, preference: "daily_reminder") => {
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

const buildReminderEmail = (userId: string) => {
  const appUrl = getAppUrl();
  const playUrl = `${appUrl}/verble`;
  const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId, "daily_reminder"))}`;

  return {
    subject: "Today's Verble is live!",
    text: [
      "Today's Verble is live!",
      "",
      "Play a quick round and keep your streak 🔥 going.",
      "",
      "Play here:",
      playUrl,
      "",
      "You received this email because daily reminders are turned on for your DailyDabble account.",
      "Turn off reminder emails:",
      unsubscribeUrl,
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Today's Verble is live!</title>
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
                      <p style="margin: 16px 0 0; color: #595c5e; font-size: 15px; line-height: 1.6; font-weight: 600;">
                        Today&apos;s Verble is live!
                      </p>
                      <p style="margin: 8px 0 0; color: #595c5e; font-size: 15px; line-height: 1.6; font-weight: 600;">
                        Play a quick round and keep your streak 🔥 going.
                      </p>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0 0; border-collapse: collapse;">
                        <tr>
                          <td>
                            <a href="${playUrl}" style="display: inline-block; border-radius: 999px; background: #5a40cb; color: #ffffff; padding: 13px 22px; font-size: 15px; line-height: 1; font-weight: 900; text-decoration: none;">
                              Play today&apos;s Verble
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 24px 0 0; color: #595c5e; font-size: 14px; line-height: 1.55; font-weight: 600;">
                        If the button does not work, copy and paste this link into your browser:
                      </p>
                      <p style="margin: 8px 0 0; word-break: break-all; color: #2c2f31; font-size: 13px; line-height: 1.5;">
                        <a href="${playUrl}" style="color: #2c2f31; text-decoration: underline;">${playUrl}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 8px 0; text-align: center; color: #75777a; font-size: 12px; line-height: 1.5;">
                      You received this email because daily reminders are turned on for your DailyDabble account.
                      <a href="${unsubscribeUrl}" style="color: #75777a; text-decoration: underline;">Unsubscribe</a>.
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Materialize every daily puzzle even when nobody visits a game that day.
  const scheduling = await scheduleTodayGames();
  const timeZone = process.env.TIMEZONE || "America/New_York";
  const localHour = getHourInTimeZone(timeZone);
  const isForcedRun = request.nextUrl.searchParams.get("force") === "1";
  const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!isForcedRun && localHour !== 9) {
    return NextResponse.json({ ok: true, skipped: "outside_reminder_hour", localHour, timeZone, scheduling });
  }

  const today = getTodayPuzzleDate();
  const supabase = getSupabaseAdmin();

  const { data: profiles, error: profileError } = await supabase
    .schema("core")
    .from("profiles")
    .select("id")
    .eq("daily_reminder_opt_in", true)
    .or(`daily_reminder_last_sent_for.is.null,daily_reminder_last_sent_for.neq.${today}`)
    .returns<ReminderProfileRow[]>();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load reminder profiles", details: profileError.message, scheduling },
      { status: 500 },
    );
  }

  const profileRows = profiles ?? [];
  if (!profileRows.length) {
    return NextResponse.json({
      ok: true,
      date: today,
      eligible: 0,
      sent: 0,
      skippedPlayed: 0,
      failed: 0,
      scheduling,
    });
  }

  const profileIds = profileRows.map((profile) => profile.id);
  const playedUserIds = new Set<string>();
  for (const ids of chunk(profileIds, PAGE_SIZE)) {
    const { data: playedRows, error: playedError } = await supabase
      .schema("core")
      .from("game_results")
      .select("user_id")
      .in("user_id", ids)
      .eq("puzzle_date", today)
      .eq("is_archive", false)
      .eq("game_slug", "verble")
      .returns<PlayedRow[]>();

    if (playedError) {
      return NextResponse.json(
        { error: "Failed to load today results", details: playedError.message, scheduling },
        { status: 500 },
      );
    }

    for (const row of playedRows ?? []) {
      if (row.user_id) {
        playedUserIds.add(row.user_id);
      }
    }
  }

  const sendableProfiles = profileRows.filter((profile) => !playedUserIds.has(profile.id));
  if (!sendableProfiles.length) {
    return NextResponse.json({
      ok: true,
      date: today,
      eligible: profileRows.length,
      sent: 0,
      skippedPlayed: playedUserIds.size,
      failed: 0,
      scheduling,
    });
  }

  if (isDryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      date: today,
      games: dailyGames.length,
      eligible: profileRows.length,
      wouldSend: sendableProfiles.length,
      skippedPlayed: playedUserIds.size,
      localHour,
      timeZone,
      forced: isForcedRun,
      scheduling,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "Reminder email is not configured", scheduling }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const sentUserIds: string[] = [];
  const failures: Array<{ userId: string; error: string }> = [];

  for (const batch of chunk(sendableProfiles, SEND_BATCH_SIZE)) {
    await Promise.all(
      batch.map(async (profile) => {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id);
        const emailAddress = userData?.user?.email;

        if (userError || !emailAddress) {
          failures.push({ userId: profile.id, error: userError?.message ?? "Missing user email" });
          return;
        }

        const email = buildReminderEmail(profile.id);
        const { error: sendError } = await resend.emails.send({
          from,
          to: emailAddress,
          subject: email.subject,
          text: email.text,
          html: email.html,
          tags: [
            { name: "type", value: "daily-reminder" },
            { name: "date", value: today },
          ],
        });

        if (sendError) {
          failures.push({ userId: profile.id, error: sendError.message });
          return;
        }

        sentUserIds.push(profile.id);
      }),
    );
  }

  for (const ids of chunk(sentUserIds, PAGE_SIZE)) {
    const { error: updateError } = await supabase
      .schema("core")
      .from("profiles")
      .update({ daily_reminder_last_sent_for: today, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to record reminder sends", details: updateError.message, scheduling },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    games: dailyGames.length,
    eligible: profileRows.length,
    sent: sentUserIds.length,
    skippedPlayed: playedUserIds.size,
    failed: failures.length,
    failures: failures.slice(0, 10),
    forced: isForcedRun,
    scheduling,
  });
}
