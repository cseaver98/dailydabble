import { NextResponse } from "next/server";
import { getChallenge, recordGuess } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { challengeDate, guessedRating } = body;

    if (!challengeDate || typeof guessedRating !== "number") {
      return NextResponse.json({ error: "challengeDate and guessedRating are required" }, { status: 400 });
    }

    const result = await recordGuess({ challengeDate, guessedRating });
    if (!result) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const challenge = await getChallenge(challengeDate, { allowRefresh: false });

    return NextResponse.json({
      isCorrect: result.isCorrect,
      actualRating: result.actualRating,
      answer: {
        id: challenge.business.id,
        name: challenge.business.name,
        city: challenge.business.city,
        state: challenge.business.state,
        category: challenge.business.category,
        yelpUrl:
          challenge.source === "yelp" && challenge.business.id
            ? `https://www.yelp.com/biz/${challenge.business.id}`
            : null
      },
      source: challenge.source
    });
  } catch (error) {
    console.error("/api/guess failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
