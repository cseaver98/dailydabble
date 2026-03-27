import { exec } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execAsync = promisify(exec);
const validBatchSizes = new Set([1, 5, 10, 15, 20]);

const runSeedScript = async (batchSize: number): Promise<{ stdout: string; stderr: string }> => {
  const poolSize = Math.max(120, Math.min(360, batchSize * 48));
  const { stdout, stderr } = await execAsync(
    `node --env-file=.env.local scripts/seed-mvp.mjs --batch-size=${batchSize} --pool-size=${poolSize}`,
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 1024 * 1024,
      timeout: 90_000,
      killSignal: "SIGTERM",
    },
  );

  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { batchSize?: number };
    const batchSize = Number(payload.batchSize ?? 1);
    if (!validBatchSizes.has(batchSize)) {
      return NextResponse.json({ error: "Invalid batch size" }, { status: 400 });
    }

    const result = await runSeedScript(batchSize);

    return NextResponse.json({
      ok: true,
      batchSize,
      output: result.stdout,
    });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr
        : "";
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: details.trim() || message }, { status: 500 });
  }
}
