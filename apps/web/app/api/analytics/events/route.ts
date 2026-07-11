import { isAnalyticsEventName, isAnalyticsGameSlug } from "@/lib/analytics-events";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_METADATA_BYTES = 2_000;
const MAX_EVENTS_PER_MINUTE = 120;

type EventBody = {
  eventId?: unknown;
  eventName?: unknown;
  sessionId?: unknown;
  gameSlug?: unknown;
  puzzleDate?: unknown;
  isArchive?: unknown;
  pagePath?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  metadata?: unknown;
};

const optionalText = (value: unknown, maxLength: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;

const getReferrerDomain = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  try {
    return new URL(value).hostname.slice(0, 255) || null;
  } catch {
    return null;
  }
};

const getDeviceType = (request: NextRequest) => {
  const userAgent = request.headers.get("user-agent") || "";
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return userAgent ? "desktop" : "unknown";
};

const validMetadata = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <= MAX_METADATA_BYTES;
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const body = (await request.json()) as EventBody;
    if (!isAnalyticsEventName(body.eventName)) {
      return NextResponse.json({ error: "Invalid eventName" }, { status: 400 });
    }
    if (typeof body.eventId !== "string" || !UUID_PATTERN.test(body.eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }
    if (typeof body.sessionId !== "string" || !UUID_PATTERN.test(body.sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }
    if (body.gameSlug != null && !isAnalyticsGameSlug(body.gameSlug)) {
      return NextResponse.json({ error: "Invalid gameSlug" }, { status: 400 });
    }
    if (body.puzzleDate != null && (typeof body.puzzleDate !== "string" || !DATE_PATTERN.test(body.puzzleDate))) {
      return NextResponse.json({ error: "Invalid puzzleDate" }, { status: 400 });
    }
    if (body.metadata != null && !validMetadata(body.metadata)) {
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }

    const pagePath = optionalText(body.pagePath, 500);
    if (!pagePath?.startsWith("/")) {
      return NextResponse.json({ error: "Invalid pagePath" }, { status: 400 });
    }

    const playerId = await getOrCreatePlayerId();
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    const supabase = getSupabaseAdmin();

    const { error: playerError } = await supabase
      .schema("core")
      .from("players")
      .upsert({ id: playerId, last_seen_at: new Date().toISOString() }, { onConflict: "id" });
    if (playerError) throw new Error(`Failed to identify analytics player: ${playerError.message}`);

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await supabase
      .schema("core")
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .gte("created_at", oneMinuteAgo);
    if (countError) throw new Error(`Failed to rate limit analytics event: ${countError.message}`);
    if ((count ?? 0) >= MAX_EVENTS_PER_MINUTE) {
      return new NextResponse(null, { status: 204 });
    }

    const { error } = await supabase.schema("core").from("analytics_events").insert({
      event_id: body.eventId,
      event_name: body.eventName,
      player_id: playerId,
      user_id: user?.id ?? null,
      session_id: body.sessionId,
      game_slug: body.gameSlug ?? null,
      puzzle_date: body.puzzleDate ?? null,
      is_archive: body.isArchive === true,
      page_path: pagePath,
      referrer_domain: getReferrerDomain(body.referrer),
      utm_source: optionalText(body.utmSource, 100),
      utm_medium: optionalText(body.utmMedium, 100),
      utm_campaign: optionalText(body.utmCampaign, 100),
      device_type: getDeviceType(request),
      metadata: body.metadata ?? {},
    });

    if (error && error.code !== "23505") {
      throw new Error(`Failed to record analytics event: ${error.message}`);
    }

    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "analytics_event_failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    return NextResponse.json({ error: "Unable to record analytics event" }, { status: 500 });
  }
}
