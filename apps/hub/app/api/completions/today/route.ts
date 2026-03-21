import { games } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const fallbackStatus = Object.fromEntries(games.map((game) => [game.slug, false]));
      return NextResponse.json({ date: today, status: fallbackStatus, persisted: false });
    }

    const playerId = await getOrCreatePlayerId();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .schema("core")
      .from("completions")
      .select("game_slug")
      .eq("player_id", playerId)
      .eq("puzzle_date", today);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load completion status", details: error.message },
        { status: 500 },
      );
    }

    const completed = new Set((data ?? []).map((row) => row.game_slug));
    const status = Object.fromEntries(games.map((game) => [game.slug, completed.has(game.slug)]));

    return NextResponse.json({ date: today, status, persisted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
