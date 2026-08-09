import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Yeardle no longer publishes a daily puzzle.",
      archiveUrl: "/yeardle/archive",
    },
    { status: 410 },
  );
}
