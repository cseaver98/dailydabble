import { NextResponse } from "next/server";
import { isYelpConfigured } from "@/lib/yelp";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    yelpConfigured: isYelpConfigured()
  });
}
