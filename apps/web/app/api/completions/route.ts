import { allowedGameSlugs } from "@/lib/games";
import { recordGameResult } from "@/lib/account-results";
import { getExistingPlayerId, getOrCreatePlayerId } from "@/lib/player-id";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

function corsHeaders(origin: string | null) {
  const isAllowedOrigin =
    !!origin &&
    (origin === "http://localhost:3000" ||
      origin === "http://localhost:3001" ||
      /^https:\/\/([a-z0-9-]+\.)?dailydabble\.app$/i.test(origin));

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin && origin ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin);
    const body = (await req.json()) as {
      gameSlug?: string;
      puzzleDate?: string;
      puzzleId?: string;
      isArchive?: boolean;
      isWin?: boolean;
      guessesUsed?: number;
      maxGuesses?: number;
      resultPayload?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    if (!body.gameSlug || !allowedGameSlugs.has(body.gameSlug)) {
      return NextResponse.json({ error: "Invalid gameSlug" }, { status: 400, headers });
    }

    const date = body.puzzleDate ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid puzzleDate" }, { status: 400, headers });
    }

    if (
      body.puzzleId &&
      typeof body.isWin === "boolean" &&
      Number.isInteger(body.guessesUsed) &&
      Number.isInteger(body.maxGuesses)
    ) {
      const authClient = await createSupabaseServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      const playerId = user ? await getExistingPlayerId() : await getOrCreatePlayerId();

      await recordGameResult({
        gameSlug: body.gameSlug,
        puzzleId: body.puzzleId,
        puzzleDate: date,
        isArchive: Boolean(body.isArchive),
        isWin: body.isWin,
        guessesUsed: Number(body.guessesUsed),
        maxGuesses: Number(body.maxGuesses),
        resultPayload: body.resultPayload ?? body.metadata ?? {},
        userId: user?.id ?? null,
        playerId,
      });

      return NextResponse.json({ ok: true, persisted: "game_results" }, { headers });
    }

    const playerId = await getOrCreatePlayerId();
    const supabase = getSupabaseAdmin();

    const { error: playerError } = await supabase
      .schema("core")
      .from("players")
      .upsert({ id: playerId, last_seen_at: new Date().toISOString() }, { onConflict: "id" });
    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500, headers });
    }

    const { error } = await supabase
      .schema("core")
      .from("completions")
      .upsert(
        {
          player_id: playerId,
          game_slug: body.gameSlug,
          puzzle_date: date,
          completed_at: new Date().toISOString(),
          metadata: body.metadata ?? {},
        },
        { onConflict: "player_id,game_slug,puzzle_date" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
