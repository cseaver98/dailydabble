import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const validBatchSizes = new Set([1, 5, 10, 15, 20]);

const findAgegapleCwd = (): string => {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), ".."),
    resolve(process.cwd(), "../.."),
  ] as const;

  const match = candidates.find((cwd) => existsSync(resolve(cwd, "apps/web/scripts/seed-agegaple-mvp.mjs")));
  if (!match) {
    throw new Error("Could not locate Agegaple seed script directory");
  }

  return resolve(match, "apps/web");
};

const runSeedScript = async ({
  batchSize,
  personName,
}: {
  batchSize: number;
  personName?: string | null;
}): Promise<{ stdout: string; stderr: string }> => {
  const cwd = findAgegapleCwd();
  const poolSize = Math.max(120, Math.min(360, batchSize * 48));
  const args = [
    "--env-file=.env.local",
    "scripts/seed-agegaple-mvp.mjs",
    `--batch-size=${batchSize}`,
    `--pool-size=${poolSize}`,
  ];
  if (personName) {
    args.push(`--person-name=${personName}`);
  }

  const { stdout, stderr } = await execFileAsync(
    "node",
    args,
    {
      cwd,
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
