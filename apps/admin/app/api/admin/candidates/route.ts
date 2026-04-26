import { NextResponse } from "next/server";

import {
  deleteReviewCandidate,
  getQueueHealth,
  listReviewCandidates,
  purgeExpiredRejectedCandidates,
  updateCandidateStatus,
} from "@/lib/puzzle-repository";
import type { CandidateFilter, CandidateStatus } from "@/lib/types";

type PatchPayload = {
  id?: string;
  status?: CandidateStatus;
};

const validStatuses: CandidateStatus[] = ["pending_review", "approved"];
const validFilters: CandidateFilter[] = ["all", "pending_review", "approved", "finished", "used_today"];

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const statusParam = requestUrl.searchParams.get("status") ?? "all";
    const pageParam = Number(requestUrl.searchParams.get("page") ?? "1");
    const pageSizeParam = Number(requestUrl.searchParams.get("pageSize") ?? "25");
    const status = statusParam as CandidateFilter;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? Math.floor(pageSizeParam) : 25;

    if (!validFilters.includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    await purgeExpiredRejectedCandidates();
    const { items, total } = await listReviewCandidates({ status, page, pageSize });
    const queueHealth = await getQueueHealth();
    return NextResponse.json({ items, total, page, pageSize, status, queueHealth });
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

export async function DELETE(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(payload.id || "");
  if (!id) {
    return NextResponse.json({ error: "Missing candidate id" }, { status: 400 });
  }

  try {
    await deleteReviewCandidate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
