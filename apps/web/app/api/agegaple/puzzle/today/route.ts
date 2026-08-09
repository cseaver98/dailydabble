import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Agegaple no longer publishes a daily puzzle.",
      archiveUrl: "/agegaple/archive",
    },
    { status: 410 },
  );
}
