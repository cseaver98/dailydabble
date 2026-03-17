import { games } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const playerId = await getOrCreatePlayerId();
    const today = new Date().toISOString().slice(0, 10);
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

    return NextResponse.json({ date: today, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
