import { NextResponse } from "next/server";
import { isArchiveLockEnabled } from "../../../../../lib/archive-lock";
import { listDoodleArchive } from "../../../../../lib/doodle/puzzle-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listDoodleArchive(120);
    return NextResponse.json({ items, lockEnabled: isArchiveLockEnabled() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
