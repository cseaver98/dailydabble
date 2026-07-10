import { NextResponse } from "next/server";
import { getVerbleSupabaseAdmin } from "@/lib/supabase/verble";

export const runtime = "nodejs";

const STATUS_VALUES = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof STATUS_VALUES)[number];
type CandidateFilter = CandidateStatus | "finished" | "today" | "all";

type PhraseRow = {
  id: string;
  phrase_text: string;
  normalized_phrase: string;
  source_note: string | null;
  status: CandidateStatus;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ScheduleRow = {
  phrase_id: string;
  puzzle_date: string;
};

const getScheduleWarning = async (phraseId: string) => {
  const supabase = getVerbleSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_schedule")
    .select("puzzle_date")
    .eq("phrase_id", phraseId)
    .order("puzzle_date", { ascending: true })
    .limit(1);
  if (error) {
    throw new Error(`Failed to check Verble schedule history: ${error.message}`);
  }
  const scheduledDate = data?.[0]?.puzzle_date;
  return scheduledDate ? `Heads up: this Verble phrase has already been scheduled or played (${scheduledDate}).` : null;
};

const getDuplicateWarning = async (phraseId: string, normalizedPhrase: string) => {
  const supabase = getVerbleSupabaseAdmin();
  const { data, error } = await supabase
    .from("phrases")
    .select("id")
    .eq("normalized_phrase", normalizedPhrase)
    .neq("id", phraseId)
    .limit(1);
  if (error) {
    throw new Error(`Failed to check Verble phrase duplicates: ${error.message}`);
  }
  return (data ?? []).length > 0 ? "Heads up: this Verble phrase already exists as another candidate." : null;
};

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getToday = (): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.TIMEZONE || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
};

const normalizePhrase = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/['-]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const status = String(requestUrl.searchParams.get("status") || "pending_review") as CandidateFilter;
    const page = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(5, Number(requestUrl.searchParams.get("pageSize") || "10")));

    if (!["all", "pending_review", "approved", "finished", "today"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getVerbleSupabaseAdmin();
    const { data: phraseRows, error: phrasesError } = await supabase
      .from("phrases")
      .select("id,phrase_text,normalized_phrase,source_note,status,reviewed_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (phrasesError) {
      throw new Error(`Failed to load Verble phrases: ${phrasesError.message}`);
    }

    const rows = (phraseRows as PhraseRow[] | null) ?? [];
    const phraseIds = rows.map((row) => row.id);

    let scheduleRows: ScheduleRow[] = [];
    if (phraseIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("phrase_id,puzzle_date")
        .in("phrase_id", phraseIds);

      if (scheduleError) {
        throw new Error(`Failed to load Verble schedule: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as ScheduleRow[] | null) ?? [];
    }

    const byPhraseId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const current = byPhraseId.get(row.phrase_id) ?? [];
      current.push(row.puzzle_date);
      byPhraseId.set(row.phrase_id, current);
    }

    const today = getToday();
    const hydrated = rows.map((row) => {
      const dates = (byPhraseId.get(row.id) ?? []).filter(isDate).sort((a, b) => b.localeCompare(a));
      const isFinished = dates.some((date) => date <= today);
      const nextScheduledDate = dates.filter((date) => date >= today).sort((a, b) => a.localeCompare(b))[0] || null;

      return {
        id: row.id,
        phrase: row.phrase_text,
        normalizedPhrase: row.normalized_phrase,
        sourceNote: row.source_note,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        scheduleCount: dates.length,
        lastScheduledDate: dates[0] || null,
        nextScheduledDate,
        isScheduledToday: dates.includes(today),
        isFinished,
      };
    });

    const filtered = hydrated.filter((row) => {
      if (status === "pending_review") return row.status === "pending_review";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      if (status === "today") return row.isScheduledToday;
      return true;
    });

    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    const pending = hydrated.filter((row) => row.status === "pending_review").length;
    const approved = hydrated.filter((row) => row.status === "approved").length;
    const approvedUnused = hydrated.filter((row) => row.status === "approved" && !row.isFinished).length;
    const finished = hydrated.filter((row) => row.isFinished).length;
    const scheduled = hydrated.filter((row) => row.scheduleCount > 0).length;
    const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 3);

    return NextResponse.json({
      ok: true,
      items,
      total: filtered.length,
      page,
      pageSize,
      queueHealth: {
        runwayDays: approvedUnused,
        pending,
        approved,
        approvedUnused,
        scheduled,
        finished,
        total: hydrated.length,
        lowQueueThreshold,
        isLow: approvedUnused < lowQueueThreshold,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Verble candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const phraseText = String(payload.phrase || "").trim().replace(/\s+/g, " ");
    const sourceNote = String(payload.sourceNote || "").trim();

    if (!phraseText) {
      return NextResponse.json({ error: "Phrase is required" }, { status: 400 });
    }

    const words = normalizePhrase(phraseText).split(" ").filter(Boolean);
    if (words.length < 2 || words.length > 12) {
      return NextResponse.json({ error: "Phrase should contain between 2 and 12 words" }, { status: 400 });
    }

    const normalizedPhrase = normalizePhrase(phraseText);
    if (!normalizedPhrase) {
      return NextResponse.json({ error: "Phrase must contain letters" }, { status: 400 });
    }
    const supabase = getVerbleSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("phrases")
      .select("id")
      .eq("normalized_phrase", normalizedPhrase)
      .limit(1);

    if (existingError) {
      throw new Error(`Failed to validate phrase uniqueness: ${existingError.message}`);
    }
    if ((existing ?? []).length > 0) {
      return NextResponse.json(
        { duplicateWarning: "This Verble phrase already exists as another candidate." },
        { status: 409 },
      );
    }

    const insertPayload = {
      phrase_text: phraseText,
      normalized_phrase: normalizedPhrase,
      source_note: sourceNote || null,
      status: "pending_review",
      reviewed_at: null,
    };

    const { data, error } = await supabase
      .from("phrases")
      .insert(insertPayload)
      .select("id,phrase_text,normalized_phrase,source_note,status,reviewed_at,created_at,updated_at")
      .single<PhraseRow>();

    if (error) {
      throw new Error(`Failed to create phrase: ${error.message}`);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Verble candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(payload.id || "").trim();
    const nextStatus = String(payload.status || "").trim() as CandidateStatus | "";
    const phraseTextRaw = payload.phrase;
    const sourceNoteRaw = payload.sourceNote;

    if (!id) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (nextStatus) {
      if (!STATUS_VALUES.includes(nextStatus as CandidateStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = nextStatus;
      patch.reviewed_at = nextStatus === "approved" ? new Date().toISOString() : null;
    }

    if (phraseTextRaw !== undefined) {
      const phraseText = String(phraseTextRaw || "").trim().replace(/\s+/g, " ");
      const normalizedPhrase = normalizePhrase(phraseText);
      if (!phraseText || !normalizedPhrase) {
        return NextResponse.json({ error: "Phrase cannot be empty" }, { status: 400 });
      }
      patch.phrase_text = phraseText;
      patch.normalized_phrase = normalizedPhrase;
    }

    if (sourceNoteRaw !== undefined) {
      const sourceNote = String(sourceNoteRaw || "").trim();
      patch.source_note = sourceNote || null;
    }

    const supabase = getVerbleSupabaseAdmin();
    let duplicateWarning: string | null = null;
    if (nextStatus === "approved") {
      let normalizedForWarning =
        typeof patch.normalized_phrase === "string" ? patch.normalized_phrase : "";
      if (!normalizedForWarning) {
        const { data: currentPhrase, error: currentPhraseError } = await supabase
          .from("phrases")
          .select("normalized_phrase")
          .eq("id", id)
          .maybeSingle<{ normalized_phrase: string }>();
        if (currentPhraseError) {
          throw new Error(`Failed to load phrase before approval: ${currentPhraseError.message}`);
        }
        normalizedForWarning = currentPhrase?.normalized_phrase ?? "";
      }
      const warnings = (
        await Promise.all([getDuplicateWarning(id, normalizedForWarning), getScheduleWarning(id)])
      ).filter(Boolean);
      duplicateWarning = warnings.length > 0 ? warnings.join("\n") : null;
      if (duplicateWarning && payload.confirmDuplicate !== true) {
        return NextResponse.json({ duplicateWarning }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from("phrases")
      .update(patch)
      .eq("id", id)
      .select("id,phrase_text,normalized_phrase,source_note,status,reviewed_at,created_at,updated_at")
      .maybeSingle<PhraseRow>();

    if (error) {
      throw new Error(`Failed to update phrase: ${error.message}`);
    }
    if (!data) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: data, warning: duplicateWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Verble candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(payload.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Candidate id is required" }, { status: 400 });
    }

    const supabase = getVerbleSupabaseAdmin();
    const { error } = await supabase.from("phrases").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete phrase: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete Verble candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
