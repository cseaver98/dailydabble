import { NextResponse } from "next/server";

import {
  getQueueHealth,
  listReviewCandidates,
  purgeExpiredRejectedCandidates,
  updateCandidateStatus,
} from "@/lib/puzzle-repository";
import type { CandidateStatus } from "@/lib/types";

type PatchPayload = {
  id?: string;
  status?: CandidateStatus;
};

const validStatuses: CandidateStatus[] = ["pending_review", "approved", "rejected"];

export async function GET() {
  try {
    await purgeExpiredRejectedCandidates();
    const items = await listReviewCandidates();
    const queueHealth = await getQueueHealth();
    return NextResponse.json({ items, queueHealth });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as PatchPayload;

  if (!payload.id || !payload.status || !validStatuses.includes(payload.status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await updateCandidateStatus(payload.id, payload.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
