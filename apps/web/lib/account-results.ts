import type { SupabaseClient } from "@supabase/supabase-js";
import { allowedGameSlugs } from "@/lib/games";
import { getOrCreatePlayerId } from "@/lib/player-id";
import { getTodayPuzzleDate } from "@/lib/puzzle-date";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const GUEST_COMPLETION_LIMIT = 3;

type GameResultInput = {
  gameSlug: string;
  puzzleId: string;
  puzzleDate: string;
  isArchive?: boolean;
  isWin: boolean;
  guessesUsed: number;
  maxGuesses: number;
  resultPayload?: Record<string, unknown>;
  userId?: string | null;
  playerId?: string | null;
  completedAt?: string;
};

type GameResultRow = {
  id: string;
  user_id: string | null;
  player_id: string | null;
  game_slug: string;
  puzzle_id: string;
  puzzle_date: string;
  is_archive: boolean;
  is_win: boolean;
  guesses_used: number;
  max_guesses: number;
  completed_at: string;
  result_payload: Record<string, unknown>;
};

type Supabase = SupabaseClient;

const assertValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid puzzleDate");
  }
};

const assertValidResultInput = (input: GameResultInput) => {
  if (!allowedGameSlugs.has(input.gameSlug)) {
    throw new Error("Invalid gameSlug");
  }
  if (!input.puzzleId) {
    throw new Error("Missing puzzleId");
  }
  assertValidDate(input.puzzleDate);
  if (!Number.isInteger(input.guessesUsed) || input.guessesUsed < 0) {
    throw new Error("Invalid guessesUsed");
  }
  if (!Number.isInteger(input.maxGuesses) || input.maxGuesses <= 0) {
    throw new Error("Invalid maxGuesses");
  }
};

export const getAccountSupabaseAdmin = () => getSupabaseAdmin();

export const ensureGuestPlayer = async ({
  supabase = getAccountSupabaseAdmin(),
  playerId,
}: {
  supabase?: Supabase;
  playerId?: string | null;
} = {}) => {
  const resolvedPlayerId = playerId || await getOrCreatePlayerId();
  const { error } = await supabase
    .schema("core")
    .from("players")
    .upsert({ id: resolvedPlayerId, last_seen_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to ensure guest player: ${error.message}`);
  }

  return resolvedPlayerId;
};

const findExistingResult = async ({
  supabase,
  input,
  ownerId,
  ownerColumn,
}: {
  supabase: Supabase;
  input: GameResultInput;
  ownerId: string;
  ownerColumn: "user_id" | "player_id";
}) => {
  const { data, error } = await supabase
    .schema("core")
    .from("game_results")
    .select("*")
    .eq(ownerColumn, ownerId)
    .eq("game_slug", input.gameSlug)
    .eq("puzzle_date", input.puzzleDate)
    .maybeSingle<GameResultRow>();

  if (error) {
    throw new Error(`Failed to read existing game result: ${error.message}`);
  }

  return data;
};

const writeLegacyCompletion = async ({
  supabase,
  playerId,
  input,
}: {
  supabase: Supabase;
  playerId: string;
  input: GameResultInput;
}) => {
  const { error } = await supabase
    .schema("core")
    .from("completions")
    .upsert(
      {
        player_id: playerId,
        game_slug: input.gameSlug,
        puzzle_date: input.puzzleDate,
        completed_at: input.completedAt ?? new Date().toISOString(),
        metadata: {
          ...(input.resultPayload ?? {}),
          puzzleId: input.puzzleId,
          isArchive: Boolean(input.isArchive),
          isWin: input.isWin,
          guessesUsed: input.guessesUsed,
          maxGuesses: input.maxGuesses,
        },
      },
      { onConflict: "player_id,game_slug,puzzle_date" },
    );

  if (error) {
    throw new Error(`Failed to write legacy completion: ${error.message}`);
  }
};

export const recordGameResult = async (input: GameResultInput) => {
  assertValidResultInput(input);

  const supabase = getAccountSupabaseAdmin();
  const completedAt = input.completedAt ?? new Date().toISOString();
  const playerId = input.userId ? input.playerId ?? null : await ensureGuestPlayer({ supabase, playerId: input.playerId });
  const ownerColumn = input.userId ? "user_id" : "player_id";
  const ownerId = input.userId ?? playerId;

  if (!ownerId) {
    throw new Error("Missing result owner");
  }

  const existing = await findExistingResult({ supabase, input, ownerId, ownerColumn });
  const payload = {
    user_id: input.userId ?? existing?.user_id ?? null,
    player_id: input.userId ? existing?.player_id ?? null : playerId,
    game_slug: input.gameSlug,
    puzzle_id: input.puzzleId,
    puzzle_date: input.puzzleDate,
    is_archive: Boolean(input.isArchive),
    is_win: input.isWin,
    guesses_used: input.guessesUsed,
    max_guesses: input.maxGuesses,
    completed_at: completedAt,
    result_payload: input.resultPayload ?? {},
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.schema("core").from("game_results").update(payload).eq("id", existing.id)
    : supabase.schema("core").from("game_results").insert(payload);

  const { data, error } = await query.select("*").single<GameResultRow>();
  if (error) {
    throw new Error(`Failed to record game result: ${error.message}`);
  }

  if (playerId) {
    await writeLegacyCompletion({ supabase, playerId, input: { ...input, completedAt } });
  }

  return data;
};

export const getGuestCompletionCount = async (playerId?: string | null) => {
  const supabase = getAccountSupabaseAdmin();
  const resolvedPlayerId = playerId || await ensureGuestPlayer({ supabase });
  const today = getTodayPuzzleDate();

  const { data: resultRows, error } = await supabase
    .schema("core")
    .from("game_results")
    .select("game_slug")
    .eq("player_id", resolvedPlayerId)
    .eq("puzzle_date", today)
    .eq("is_archive", false)
    .returns<Array<{ game_slug: string }>>();

  if (error) {
    throw new Error(`Failed to count guest completions: ${error.message}`);
  }

  const { data: legacyRows, error: legacyError } = await supabase
    .schema("core")
    .from("completions")
    .select("game_slug")
    .eq("player_id", resolvedPlayerId)
    .eq("puzzle_date", today)
    .returns<Array<{ game_slug: string }>>();

  if (legacyError) {
    throw new Error(`Failed to count legacy guest completions: ${legacyError.message}`);
  }

  const completedGameSlugs = new Set([
    ...(resultRows ?? []).map((row) => row.game_slug),
    ...(legacyRows ?? []).map((row) => row.game_slug),
  ].filter((gameSlug) => allowedGameSlugs.has(gameSlug)));
  const count = completedGameSlugs.size;

  return { playerId: resolvedPlayerId, count, limit: GUEST_COMPLETION_LIMIT, locked: count >= GUEST_COMPLETION_LIMIT };
};

export const hasGuestTodayCompletion = async ({
  playerId,
  gameSlug,
  puzzleDate,
}: {
  playerId: string;
  gameSlug: string;
  puzzleDate: string;
}) => {
  if (!allowedGameSlugs.has(gameSlug)) {
    return false;
  }

  assertValidDate(puzzleDate);

  const supabase = getAccountSupabaseAdmin();
  const { data: resultRow, error: resultError } = await supabase
    .schema("core")
    .from("game_results")
    .select("id")
    .eq("player_id", playerId)
    .eq("game_slug", gameSlug)
    .eq("puzzle_date", puzzleDate)
    .eq("is_archive", false)
    .maybeSingle<{ id: string }>();

  if (resultError) {
    throw new Error(`Failed to read today game result: ${resultError.message}`);
  }

  if (resultRow) {
    return true;
  }

  const { data: completionRow, error: completionError } = await supabase
    .schema("core")
    .from("completions")
    .select("player_id")
    .eq("player_id", playerId)
    .eq("game_slug", gameSlug)
    .eq("puzzle_date", puzzleDate)
    .maybeSingle<{ player_id: string }>();

  if (completionError) {
    throw new Error(`Failed to read today completion: ${completionError.message}`);
  }

  return Boolean(completionRow);
};

export const claimGuestResultsForUser = async ({
  playerId,
  userId,
}: {
  playerId: string;
  userId: string;
}) => {
  const supabase = getAccountSupabaseAdmin();
  await ensureGuestPlayer({ supabase, playerId });

  const { error: playerError } = await supabase
    .schema("core")
    .from("players")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq("id", playerId);

  if (playerError) {
    throw new Error(`Failed to claim guest player: ${playerError.message}`);
  }

  const { data: guestRows, error: readError } = await supabase
    .schema("core")
    .from("game_results")
    .select("*")
    .eq("player_id", playerId)
    .is("user_id", null);

  if (readError) {
    throw new Error(`Failed to read guest results: ${readError.message}`);
  }

  let claimed = 0;
  let skipped = 0;
  for (const row of guestRows ?? []) {
    const existing = await findExistingResult({
      supabase,
      input: {
        gameSlug: row.game_slug,
        puzzleId: row.puzzle_id,
        puzzleDate: row.puzzle_date,
        isWin: row.is_win,
        guessesUsed: row.guesses_used,
        maxGuesses: row.max_guesses,
      },
      ownerId: userId,
      ownerColumn: "user_id",
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .schema("core")
      .from("game_results")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Failed to claim guest result: ${updateError.message}`);
    }
    claimed += 1;
  }

  return { playerId, userId, claimed, skipped };
};
