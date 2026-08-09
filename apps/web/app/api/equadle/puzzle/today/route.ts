import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Equadle no longer publishes a daily puzzle.",
      archiveUrl: "/equadle/archive",
    },
    { status: 410 },
  );
}
