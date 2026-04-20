import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const candidateId = String(payload?.candidateId || "");
    const puzzleDate = String(payload?.puzzleDate || "");

    if (!candidateId || !isDateString(puzzleDate)) {
      return NextResponse.json({ error: "candidateId and puzzleDate(YYYY-MM-DD) are required" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { data: movie, error: movieError } = await supabase
      .from("movies")
      .select("id,status,still_urls")
      .eq("id", candidateId)
      .maybeSingle();
    if (movieError) {
      throw new Error(`Failed to validate candidate: ${movieError.message}`);
    }
    if (!movie) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (movie.status !== "approved") {
      return NextResponse.json({ error: "Only approved candidates can be scheduled." }, { status: 400 });
    }
    if (!Array.isArray(movie.still_urls) || movie.still_urls.filter(Boolean).length < 1) {
      return NextResponse.json({ error: "Candidate needs at least one still image before scheduling." }, { status: 400 });
    }

    const { error: scheduleError } = await supabase
      .from("daily_schedule")
      .upsert({ puzzle_date: puzzleDate, movie_id: candidateId }, { onConflict: "puzzle_date" });
    if (scheduleError) {
      throw new Error(`Failed to schedule candidate: ${scheduleError.message}`);
    }

    return NextResponse.json({ ok: true, candidateId, puzzleDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
