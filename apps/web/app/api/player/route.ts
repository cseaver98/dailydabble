import { getOrCreatePlayerId, resetPlayerId } from "@/lib/player-id";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const playerId = await getOrCreatePlayerId();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .schema("core")
      .from("players")
      .upsert({ id: playerId, last_seen_at: new Date().toISOString() }, { onConflict: "id" });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create player", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ playerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const playerId = await resetPlayerId();
    return NextResponse.json({ playerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
