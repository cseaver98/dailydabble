import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execAsync = promisify(exec);
const validBatchSizes = new Set([1, 5, 10, 15, 20]);

const findAgegapleCwd = (): string => {
  const candidates = [
    resolve(process.cwd(), "apps/agegaple"),
    resolve(process.cwd(), "../agegaple"),
    process.cwd(),
  ];

  const match = candidates.find((cwd) => existsSync(resolve(cwd, "scripts/seed-mvp.mjs")));
  if (!match) {
    throw new Error("Could not locate Agegaple seed script directory");
  }

  return match;
};

const runSeedScript = async (batchSize: number): Promise<{ stdout: string; stderr: string }> => {
  const cwd = findAgegapleCwd();
  const { stdout, stderr } = await execAsync(
    `node --env-file=.env.local scripts/seed-mvp.mjs --batch-size=${batchSize}`,
    {
      cwd,
      env: process.env,
      maxBuffer: 1024 * 1024,
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
      error && typeof error === "object" && "stderr" in error && typeof (error as { stderr?: string }).stderr === "string"
        ? (error as { stderr?: string }).stderr
        : "";
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, details: details.trim() || message }, { status: 500 });
  }
}
