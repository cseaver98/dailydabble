import { NextResponse } from "next/server";
import { listSportleArchive } from "../../../../../lib/sportle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listSportleArchive(180);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
