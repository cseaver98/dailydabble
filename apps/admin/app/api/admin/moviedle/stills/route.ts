import { NextResponse } from "next/server";
import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const candidateId = String(url.searchParams.get("candidateId") || "");
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { data, error } = await supabase
      .from("movies")
      .select("id,still_urls")
      .eq("id", candidateId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load stills: ${error.message}`);
    }
    if (!data) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({
      stillUrls: Array.isArray(data.still_urls) ? data.still_urls.filter(Boolean) : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load stills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const candidateId = String(payload?.candidateId || "");
    const action = String(payload?.action || "");
    const url = String(payload?.url || "").trim();

    if (!candidateId || (action !== "add" && action !== "remove")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getMoviedleSupabaseAdmin();
    const { data, error } = await supabase
      .from("movies")
      .select("id,still_urls")
      .eq("id", candidateId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load candidate stills: ${error.message}`);
    }
    if (!data) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const current = Array.isArray(data.still_urls) ? data.still_urls.filter(Boolean) : [];
    let next = current;
    if (action === "add") {
      if (!url) {
        return NextResponse.json({ error: "url is required for add" }, { status: 400 });
      }
      next = Array.from(new Set([...current, url])).slice(0, 6);
    } else if (action === "remove") {
      if (!url) {
        return NextResponse.json({ error: "url is required for remove" }, { status: 400 });
      }
      next = current.filter((item) => item !== url);
    }

    const { error: updateError } = await supabase
      .from("movies")
      .update({ still_urls: next })
      .eq("id", candidateId);
    if (updateError) {
      throw new Error(`Failed updating stills: ${updateError.message}`);
    }

    return NextResponse.json({ ok: true, stillUrls: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update stills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
