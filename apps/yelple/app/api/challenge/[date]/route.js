import { NextResponse } from "next/server";
import { ensureChallenge, getChallenge } from "@/lib/db";

export async function GET(req, context) {
  try {
    const { date } = await context.params;
    const replay = new URL(req.url).searchParams.get("replay") === "1";

    await ensureChallenge(date);
    const challenge = await getChallenge(date, { allowRefresh: replay });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    return NextResponse.json({
      challengeDate: challenge.challengeDate,
      source: challenge.source,
      hasProviderContent: challenge.hasProviderContent,
      hints: challenge.hints,
      business: {
        city: challenge.business.city,
        state: challenge.business.state,
        category: challenge.business.category
      }
    });
  } catch (error) {
    console.error("/api/challenge/[date] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
