import { NextResponse } from "next/server";
import { searchMoviedleTitles } from "../../../../lib/puzzle-repository";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || "8");
    const suggestions = await searchMoviedleTitles(query, limit);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
