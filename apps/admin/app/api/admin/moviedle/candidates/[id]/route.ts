import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const id = String(params?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { data, error } = await supabase
      .from("movies")
      .select("id,title,release_year,summary,lead_actors,still_urls,status,source,review_notes,reviewed_at,created_at,imdb_votes,imdb_id")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load candidate details: ${error.message}`);
    }
    if (!data) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ details: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load candidate details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const id = String(params?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const title = String(payload?.title || "").trim();
    const releaseYear = Number(payload?.releaseYear);
    const summary = String(payload?.summary || "").trim();
    const reviewNotes = String(payload?.reviewNotes || "").trim();
    const leadActors = Array.isArray(payload?.leadActors)
      ? payload.leadActors.map((actor: unknown) => String(actor || "").trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!title) {
      return NextResponse.json({ error: "Movie title is required" }, { status: 400 });
    }

    const normalizedTitle = title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const safeReleaseYear =
      Number.isFinite(releaseYear) && releaseYear >= 1888 && releaseYear <= 2100 ? Math.floor(releaseYear) : null;

    const supabase = getMoviedleSupabaseAdmin();
    const { error: updateError } = await supabase
      .from("movies")
      .update({
        title,
        title_normalized: normalizedTitle,
        release_year: safeReleaseYear,
        summary: summary ? summary.slice(0, 4000) : null,
        lead_actors: leadActors,
        review_notes: reviewNotes || null,
      })
      .eq("id", id);
    if (updateError) {
      throw new Error(`Failed to update candidate details: ${updateError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
