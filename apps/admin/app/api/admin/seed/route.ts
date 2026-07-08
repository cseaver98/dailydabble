import { NextResponse } from "next/server";
import { runAgegapleSeed } from "../../../../../web/scripts/seed-agegaple-mvp.mjs";

export const runtime = "nodejs";

const validBatchSizes = new Set([1, 5, 10, 15, 20]);
const runAgegapleSeedWithOptions = runAgegapleSeed as (options: {
  batchSize: number;
  poolSize: number;
  personName?: string | null;
  log: (line: string) => void;
}) => Promise<void>;

const runSeedScript = async ({
  batchSize,
  personName,
}: {
  batchSize: number;
  personName?: string | null;
}): Promise<{ stdout: string; stderr: string }> => {
  const poolSize = Math.max(120, Math.min(360, batchSize * 48));
  const output: string[] = [];

  await runAgegapleSeedWithOptions({
    batchSize,
    poolSize,
    personName,
    log: (line: string) => output.push(line),
  });

  return { stdout: output.join("\n").trim(), stderr: "" };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { batchSize?: number; personName?: string };
    const batchSize = Number(payload.batchSize ?? 1);
    const personName = String(payload.personName ?? "").trim();
    if (!validBatchSizes.has(batchSize)) {
      return NextResponse.json({ error: "Invalid batch size" }, { status: 400 });
    }
    if (personName && personName.length < 2) {
      return NextResponse.json({ error: "Person name must be at least 2 characters" }, { status: 400 });
    }

    const result = await runSeedScript({ batchSize, personName });

    return NextResponse.json({
      ok: true,
      batchSize,
      personName: personName || null,
      output: result.stdout,
    });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && typeof (error as { stderr?: string }).stderr === "string"
        ? (error as { stderr?: string }).stderr
        : "";
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: details.trim() || message }, { status: 500 });
  }
}
