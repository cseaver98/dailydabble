import { NextResponse } from "next/server";
import {
  CONTENT_TTL_HOURS,
  ensureChallenge,
  getChallenge,
  purgeExpiredProviderContent,
  toDateString
} from "@/lib/db";

export async function GET() {
  try {
    const today = toDateString(new Date());
    await ensureChallenge(today);
    await purgeExpiredProviderContent();

    const challenge = await getChallenge(today, { allowRefresh: true });
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    return NextResponse.json({
      challengeDate: challenge.challengeDate,
      source: challenge.source,
      ttlHours: CONTENT_TTL_HOURS,
      hasProviderContent: challenge.hasProviderContent,
      hints: challenge.hints,
      business: {
        city: challenge.business.city,
        state: challenge.business.state,
        category: challenge.business.category
      }
    });
  } catch (error) {
    console.error("/api/challenge/today failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
