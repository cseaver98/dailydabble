import { games } from "@/lib/games";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildReminderEmail = () => {
  const appUrl = getAppUrl();
  const accountUrl = `${appUrl}/account`;

  return {
    subject: "Today's DailyDabble games are live",
    text: [
      "Today's DailyDabble games are live.",
      "",
      "Play here:",
      appUrl,
      "",
      "You can manage daily reminder emails from your account settings:",
      accountUrl,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #2c2f31; line-height: 1.5;">
        <p>Today's DailyDabble games are live.</p>
        <p><a href="${appUrl}" style="color: #2f8f46; font-weight: 700;">Play today's games</a></p>
        <p style="font-size: 13px; color: #6b7280;">
          You can manage daily reminder emails from
          <a href="${accountUrl}" style="color: #2f8f46;">your account settings</a>.
        </p>
      </div>
    `,
  };
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timeZone = process.env.TIMEZONE || "America/New_York";
  const localHour = getHourInTimeZone(timeZone);
  const isForcedRun = request.nextUrl.searchParams.get("force") === "1";
  const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!isForcedRun && localHour !== 9) {
    return NextResponse.json({ ok: true, skipped: "outside_reminder_hour", localHour, timeZone });
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
    return NextResponse.json({ error: "Failed to load reminder profiles", details: profileError.message }, { status: 500 });
  }

  const profileRows = profiles ?? [];
  if (!profileRows.length) {
    return NextResponse.json({ ok: true, date: today, eligible: 0, sent: 0, skippedPlayed: 0, failed: 0 });
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
      .returns<PlayedRow[]>();

    if (playedError) {
      return NextResponse.json({ error: "Failed to load today results", details: playedError.message }, { status: 500 });
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
    });
  }

  if (isDryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      date: today,
      games: games.length,
      eligible: profileRows.length,
      wouldSend: sendableProfiles.length,
      skippedPlayed: playedUserIds.size,
      localHour,
      timeZone,
      forced: isForcedRun,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "Reminder email is not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const email = buildReminderEmail();
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
      return NextResponse.json({ error: "Failed to record reminder sends", details: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    games: games.length,
    eligible: profileRows.length,
    sent: sentUserIds.length,
    skippedPlayed: playedUserIds.size,
    failed: failures.length,
    failures: failures.slice(0, 10),
    forced: isForcedRun,
  });
}
