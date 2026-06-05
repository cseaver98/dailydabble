import { NextRequest, NextResponse } from "next/server";
import { searchSportleAthletes } from "../../../../../lib/sportle/puzzle-repository";

export const runtime = "nodejs";

const supportedSports = new Set(["nba", "nfl", "mlb", "soccer", "nhl"]);

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "");
    const sport = String(url.searchParams.get("sport") || "nba").toLowerCase();

    if (!supportedSports.has(sport)) {
      return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
    }

    const items = await searchSportleAthletes({ sport, query, limit: 12 });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search athletes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
