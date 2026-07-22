import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

const validStatuses = ["pending", "approved"] as const;
const REQUIRED_STILL_COUNT = 6;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "today" | "all";

const isStatus = (value: string): value is CandidateStatus =>
  validStatuses.includes(value as CandidateStatus);

type OmdbDetail = {
  Response?: string;
  imdbID?: string;
  Title?: string;
  Year?: string;
  Plot?: string;
  Actors?: string;
  Director?: string;
  imdbVotes?: string;
};

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseVotes = (value: string | undefined): number => {
  const raw = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseReleaseYear = (value: string | undefined): number | null => {
  const match = String(value || "").match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1888 || year > 2100) return null;
  return year;
};

const getScheduleWarning = async (movieId: string) => {
  const supabase = getMoviedleSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .eq("movie_id", movieId)
    .order("puzzle_date", { ascending: true })
    .limit(1);
  if (error) {
    throw new Error(`Failed to check Moviedle schedule history: ${error.message}`);
  }
  const scheduledDate = data?.[0]?.puzzle_date;
  return scheduledDate ? `Heads up: this Moviedle movie has already been scheduled or played (${scheduledDate}).` : null;
};

const getDuplicateWarning = async (movieId: string) => {
  const supabase = getMoviedleSupabaseAdmin();
  const { data: movie, error: movieError } = await supabase
    .from("movies")
    .select("title,release_year,imdb_id")
    .eq("id", movieId)
    .maybeSingle<{ title: string; release_year: number | null; imdb_id: string | null }>();
  if (movieError) {
    throw new Error(`Failed to check Moviedle movie duplicates: ${movieError.message}`);
  }
  if (!movie?.title) return null;
  let query = supabase.from("movies").select("id").neq("id", movieId).limit(1);
  if (movie.imdb_id) {
    query = query.eq("imdb_id", movie.imdb_id);
  } else {
    query = query.eq("title", movie.title);
    query = movie.release_year == null ? query.is("release_year", null) : query.eq("release_year", movie.release_year);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to check Moviedle movie duplicates: ${error.message}`);
  }
  return (data ?? []).length > 0 ? "Heads up: this Moviedle movie already exists as another candidate." : null;
};

const fetchOmdbByTitle = async (apiKey: string, title: string): Promise<OmdbDetail | null> => {
  const params = new URLSearchParams({
    apikey: apiKey,
    t: title,
    type: "movie",
    plot: "short",
  });
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as OmdbDetail;
  if (payload.Response !== "True") {
    return null;
  }
  return payload;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = String(url.searchParams.get("status") || "pending");
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || "10")));

    const status = statusParam as CandidateFilter;
    if (status !== "all" && status !== "finished" && status !== "today" && !isStatus(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const offset = (page - 1) * pageSize;
    const needsDerivedFilter = status === "finished" || status === "approved" || status === "today";
    let totalCount = 0;

    if (!needsDerivedFilter) {
      let countQuery = supabase.from("movies").select("id", { count: "exact", head: true });
      if (status === "pending") {
        countQuery = countQuery.eq("status", status);
      }
      const { count, error: countError } = await countQuery;
      if (countError) {
        throw new Error(`Failed counting movie candidates: ${countError.message}`);
      }
      totalCount = count || 0;
    }

    let dataQuery = supabase
      .from("movies")
      .select("id,title,release_year,director,summary,lead_actors,still_urls,status,source,review_notes,reviewed_at,created_at,imdb_votes")
      .order("created_at", { ascending: false });
    if (status === "pending" || status === "approved") {
      dataQuery = dataQuery.eq("status", status);
    }
    if (!needsDerivedFilter) {
      dataQuery = dataQuery.range(offset, offset + pageSize - 1);
    }

    const { data, error } = await dataQuery;
    if (error) {
      throw new Error(`Failed loading movie candidates: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    const movieIds = rows.map((row) => row.id);

    let scheduleRows: { movie_id: string; puzzle_date: string }[] = [];
    if (movieIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("movie_id,puzzle_date")
        .in("movie_id", movieIds);
      if (scheduleError) {
        throw new Error(`Failed loading schedule usage: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as { movie_id: string; puzzle_date: string }[] | null) ?? [];
    }

    const usageByMovieId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const existing = usageByMovieId.get(row.movie_id) ?? [];
      existing.push(row.puzzle_date);
      usageByMovieId.set(row.movie_id, existing);
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

    const hydrated = rows.map((row) => {
        const dates = (usageByMovieId.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
        const nextScheduledDate =
          dates
            .filter((date) => date >= today)
            .sort((a, b) => a.localeCompare(b))[0] ?? null;
        const isFinished = dates.some((date) => date <= today);
        return {
          ...row,
          stillCount: Array.isArray(row.still_urls) ? row.still_urls.filter(Boolean).length : 0,
          scheduleCount: dates.length,
          lastScheduledDate: dates[0] || null,
          nextScheduledDate,
          isScheduledToday: dates.includes(today),
          isFinished,
        };
      });

    const filtered = hydrated.filter((row) => {
      if (status === "pending") return row.status === "pending";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      if (status === "today") return row.isScheduledToday;
      return true;
    });
    const items = needsDerivedFilter ? filtered.slice(offset, offset + pageSize) : filtered;

    const [{ data: allMovies, error: allMoviesError }, { data: allSchedule, error: allScheduleError }] = await Promise.all([
      supabase.from("movies").select("id,status,still_urls"),
      supabase.from("daily_schedule").select("movie_id,puzzle_date"),
    ]);
    if (allMoviesError) {
      throw new Error(`Failed loading queue health movies: ${allMoviesError.message}`);
    }
    if (allScheduleError) {
      throw new Error(`Failed loading queue health schedules: ${allScheduleError.message}`);
    }
    const finishedIds = new Set(
      ((allSchedule as Array<{ movie_id: string; puzzle_date: string }> | null) ?? [])
        .filter((row) => row.puzzle_date <= today)
        .map((row) => row.movie_id),
    );
    let pending = 0;
    let approved = 0;
    let finished = 0;
    for (const row of ((allMovies as Array<{ id: string; status: string; still_urls?: string[] | null }> | null) ?? [])) {
      if (row.status === "pending") pending += 1;
      if (row.status === "approved") approved += 1;
      if (finishedIds.has(row.id)) finished += 1;
    }
    const approvedUnused = ((allMovies as Array<{ id: string; status: string; still_urls?: string[] | null }> | null) ?? []).filter(
      (row) => row.status === "approved"
        && !finishedIds.has(row.id)
        && Array.isArray(row.still_urls)
        && row.still_urls.filter(Boolean).length === REQUIRED_STILL_COUNT,
    ).length;
    const scheduled = new Set(((allSchedule as Array<{ movie_id: string; puzzle_date: string }> | null) ?? []).map((row) => row.movie_id)).size;
    const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 3);

    return NextResponse.json({
      items,
      total: needsDerivedFilter ? filtered.length : totalCount,
      page,
      pageSize,
      status,
      queueHealth: {
        runwayDays: approvedUnused,
        approved,
        approvedUnused,
        scheduled,
        pending,
        finished,
        total: ((allMovies as Array<{ id: string; status: string; still_urls?: string[] | null }> | null) ?? []).length,
        lowQueueThreshold,
        isLow: approvedUnused < lowQueueThreshold,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OMDB_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OMDB_API_KEY in env." }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const titleId = String(payload?.titleId || "").trim();
    const providedTitle = String(payload?.title || "").trim();

    const supabase = getMoviedleSupabaseAdmin();

    let selectedTitle = providedTitle;
    if (titleId) {
      const { data: titleRow, error: titleError } = await supabase
        .from("movie_titles")
        .select("id,title")
        .eq("id", titleId)
        .maybeSingle();
      if (titleError) {
        throw new Error(`Failed loading selected title: ${titleError.message}`);
      }
      if (!titleRow?.title) {
        return NextResponse.json({ error: "Selected title not found in title library." }, { status: 404 });
      }
      selectedTitle = titleRow.title;
    }

    if (!selectedTitle) {
      return NextResponse.json({ error: "A movie title is required." }, { status: 400 });
    }

    const detail = await fetchOmdbByTitle(apiKey, selectedTitle);
    if (!detail) {
      return NextResponse.json({ error: `Could not find "${selectedTitle}" in OMDb.` }, { status: 404 });
    }

    const title = String(detail.Title || "").trim();
    const titleNormalized = normalizeTitle(title || selectedTitle);
    const releaseYear = parseReleaseYear(detail.Year);
    const imdbVotes = parseVotes(detail.imdbVotes);
    const summary = String(detail.Plot || "").trim();
    const director = String(detail.Director || "").trim();
    const leadActors = String(detail.Actors || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!title || !titleNormalized) {
      return NextResponse.json({ error: "OMDb did not return a valid movie title." }, { status: 400 });
    }

    const moviePayload = {
      imdb_id: detail.imdbID || null,
      imdb_votes: imdbVotes,
      title,
      title_normalized: titleNormalized,
      release_year: releaseYear,
      director: director ? director.slice(0, 200) : null,
      summary: summary ? summary.slice(0, 4000) : null,
      lead_actors: leadActors,
      source: "title_library_omdb",
      status: "pending",
      reviewed_at: null,
    };

    if (detail.imdbID) {
      const titleLibraryPayload = {
        title,
        imdb_id: detail.imdbID,
        source: "omdb",
      };
      const { error: titleLibraryUpdateError } = titleId
        ? await supabase
          .from("movie_titles")
          .update(titleLibraryPayload)
          .eq("id", titleId)
        : await supabase
          .from("movie_titles")
          .upsert(
            {
              ...titleLibraryPayload,
              title_normalized: titleNormalized,
            },
            { onConflict: "title_normalized", ignoreDuplicates: false },
          );
      if (titleLibraryUpdateError) {
        throw new Error(`Failed syncing title library entry: ${titleLibraryUpdateError.message}`);
      }
    }

    let existingMovieId: string | null = null;
    if (detail.imdbID) {
      const { data: existingByImdb, error: existingByImdbError } = await supabase
        .from("movies")
        .select("id")
        .eq("imdb_id", detail.imdbID)
        .limit(1);
      if (existingByImdbError) {
        throw new Error(`Failed checking existing candidate by imdb_id: ${existingByImdbError.message}`);
      }
      existingMovieId = existingByImdb?.[0]?.id || null;
    }

    if (!existingMovieId) {
      const { data: existingByTitle, error: existingByTitleError } = await supabase
        .from("movies")
        .select("id")
        .eq("title_normalized", titleNormalized)
        .limit(1);
      if (existingByTitleError) {
        throw new Error(`Failed checking existing candidate by title: ${existingByTitleError.message}`);
      }
      existingMovieId = existingByTitle?.[0]?.id || null;
    }

    if (existingMovieId) {
      return NextResponse.json(
        { duplicateWarning: "This Moviedle movie already exists as another candidate." },
        { status: 409 },
      );
    }

    const { data: insertData, error: insertError } = await supabase
      .from("movies")
      .insert({
        ...moviePayload,
        aliases: [],
        aliases_normalized: [],
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      throw new Error(`Failed creating movie candidate: ${insertError.message}`);
    }

    return NextResponse.json({
      ok: true,
      action: "created",
      candidateId: insertData?.id || null,
      title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create candidate from title";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const id = String(payload?.id || "");
    const status = String(payload?.status || "");

    if (!id || !isStatus(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const warnings =
      status === "approved"
        ? (await Promise.all([getDuplicateWarning(id), getScheduleWarning(id)])).filter(Boolean)
        : [];
    const warning = warnings.length > 0 ? warnings.join("\n") : null;
    if (warning && payload.confirmDuplicate !== true) {
      return NextResponse.json({ duplicateWarning: warning }, { status: 409 });
    }
    if (status === "approved") {
      const { data, error } = await supabase
        .from("movies")
        .select("id,still_urls")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to validate candidate before approval: ${error.message}`);
      }
      const stills = Array.isArray(data?.still_urls) ? data.still_urls.filter(Boolean) : [];
      if (stills.length !== REQUIRED_STILL_COUNT) {
        return NextResponse.json({ error: `Add exactly ${REQUIRED_STILL_COUNT} still images before approving.` }, { status: 400 });
      }
    }

    const reviewedAt = status === "pending" ? null : new Date().toISOString();
    const { error: updateError } = await supabase
      .from("movies")
      .update({ status, reviewed_at: reviewedAt })
      .eq("id", id);
    if (updateError) {
      throw new Error(`Failed to update candidate status: ${updateError.message}`);
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const id = String(payload?.id || "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { error: scheduleError } = await supabase.from("daily_schedule").delete().eq("movie_id", id);
    if (scheduleError) {
      throw new Error(`Failed deleting movie schedule rows: ${scheduleError.message}`);
    }
    const { error: deleteError } = await supabase.from("movies").delete().eq("id", id);
    if (deleteError) {
      throw new Error(`Failed deleting movie candidate: ${deleteError.message}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
