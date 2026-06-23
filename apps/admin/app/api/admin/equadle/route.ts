import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const allowedEquation = /^[0-9+\-*/=]+$/;
const validStatuses = ["pending_review", "approved"] as const;
type CandidateStatus = (typeof validStatuses)[number];
type CandidateFilter = CandidateStatus | "finished" | "today" | "all";

const precedence: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

const getSupabaseEquadleAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "equadle",
    },
  });

const tokenizeExpression = (expr: string): string[] => {
  const tokens = expr.match(/\d+|[+\-*/]/g) || [];
  if (tokens.join("") !== expr) {
    throw new Error("Guess must be a valid equation");
  }
  if (tokens.length === 0 || /[+\-*/]/.test(tokens[0]) || /[+\-*/]/.test(tokens[tokens.length - 1])) {
    throw new Error("Guess must be a valid equation");
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const shouldBeNumber = index % 2 === 0;
    if (shouldBeNumber && !/^\d+$/.test(token)) {
      throw new Error("Guess must be a valid equation");
    }
    if (!shouldBeNumber && !/[+\-*/]/.test(token)) {
      throw new Error("Guess must be a valid equation");
    }
  }
  return tokens;
};

const toRpn = (tokens: string[]): string[] => {
  const output: string[] = [];
  const operators: string[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      output.push(token);
      continue;
    }

    while (operators.length > 0 && precedence[operators[operators.length - 1]] >= precedence[token]) {
      output.push(operators.pop() as string);
    }
    operators.push(token);
  }

  while (operators.length > 0) {
    output.push(operators.pop() as string);
  }

  return output;
};

const evalRpn = (tokens: string[]): number => {
  const stack: number[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      stack.push(Number(token));
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error("Guess must be a valid equation");
    }

    let value = 0;
    if (token === "+") value = (a as number) + (b as number);
    if (token === "-") value = (a as number) - (b as number);
    if (token === "*") value = (a as number) * (b as number);
    if (token === "/") {
      if ((b as number) === 0 || (a as number) % (b as number) !== 0) {
        throw new Error("Equation must be true");
      }
      value = (a as number) / (b as number);
    }

    if (!Number.isInteger(value)) {
      throw new Error("Equation must be true");
    }

    stack.push(value);
  }

  if (stack.length !== 1 || !Number.isInteger(stack[0])) {
    throw new Error("Guess must be a valid equation");
  }

  return stack[0];
};

const validateEquation = (raw: string, expectedLength = 8): string => {
  const equation = String(raw || "").trim();
  if (equation.length !== expectedLength) {
    throw new Error(`Guess must be ${expectedLength} characters`);
  }
  if (!allowedEquation.test(equation)) {
    throw new Error("Guess must be a valid equation");
  }

  const parts = equation.split("=");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Guess must be a valid equation");
  }

  const left = evalRpn(toRpn(tokenizeExpression(parts[0])));
  const right = evalRpn(toRpn(tokenizeExpression(parts[1])));
  if (left !== right) {
    throw new Error("Equation must be true");
  }

  return equation;
};

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const randomOperator = (): "+" | "-" | "*" | "/" => {
  const operators: Array<"+" | "-" | "*" | "/"> = ["+", "-", "*", "/"];
  return operators[randomInt(0, operators.length - 1)];
};

const generateRandomEquation = (expectedLength = 8): string => {
  for (let attempt = 0; attempt < 3000; attempt += 1) {
    const a = randomInt(1, 99);
    const b = randomInt(1, 99);
    const c = randomInt(1, 99);
    const op1 = randomOperator();
    const op2 = randomOperator();
    const left = `${a}${op1}${b}${op2}${c}`;

    let leftValue = 0;
    try {
      leftValue = evalRpn(toRpn(tokenizeExpression(left)));
    } catch {
      continue;
    }
    if (!Number.isInteger(leftValue) || leftValue < 0) {
      continue;
    }

    const equation = `${left}=${leftValue}`;
    if (equation.length !== expectedLength) {
      continue;
    }

    try {
      return validateEquation(equation, expectedLength);
    } catch {
      continue;
    }
  }

  throw new Error("Could not generate a valid random equation");
};

const getToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const status = String(requestUrl.searchParams.get("status") || "pending_review") as CandidateFilter;
    const page = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(5, Number(requestUrl.searchParams.get("pageSize") || "10")));

    if (!["all", "pending_review", "approved", "finished", "today"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = getSupabaseEquadleAdmin();
    const { data: puzzleRows, error: puzzlesError } = await supabase
      .from("puzzles")
      .select("id,equation,equation_length,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (puzzlesError) {
      throw new Error(`Failed to load Equadle puzzles: ${puzzlesError.message}`);
    }

    const rows = (puzzleRows as Array<{ id: string; equation: string; equation_length: number; status: CandidateStatus; created_at: string }> | null) ?? [];
    const puzzleIds = rows.map((row) => row.id);

    let scheduleRows: Array<{ puzzle_id: string; puzzle_date: string }> = [];
    if (puzzleIds.length > 0) {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("daily_schedule")
        .select("puzzle_id,puzzle_date")
        .in("puzzle_id", puzzleIds);
      if (scheduleError) {
        throw new Error(`Failed to load Equadle schedule: ${scheduleError.message}`);
      }
      scheduleRows = (scheduleData as Array<{ puzzle_id: string; puzzle_date: string }> | null) ?? [];
    }

    const byPuzzleId = new Map<string, string[]>();
    for (const row of scheduleRows) {
      const current = byPuzzleId.get(row.puzzle_id) ?? [];
      current.push(row.puzzle_date);
      byPuzzleId.set(row.puzzle_id, current);
    }

    const today = getToday();
    const hydrated = rows.map((row) => {
      const dates = (byPuzzleId.get(row.id) ?? []).sort((a, b) => b.localeCompare(a));
      const isFinished = dates.some((date) => date <= today);
      const nextScheduledDate = dates.filter((date) => date >= today).sort((a, b) => a.localeCompare(b))[0] || null;
      return {
        ...row,
        scheduleCount: dates.length,
        lastScheduledDate: dates[0] || null,
        nextScheduledDate,
        isScheduledToday: dates.includes(today),
        isFinished,
      };
    });

    const filtered = hydrated.filter((row) => {
      if (status === "pending_review") return row.status === "pending_review";
      if (status === "approved") return row.status === "approved" && !row.isFinished;
      if (status === "finished") return row.isFinished;
      if (status === "today") return row.isScheduledToday;
      return true;
    });

    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    const pending = hydrated.filter((row) => row.status === "pending_review").length;
    const approved = hydrated.filter((row) => row.status === "approved").length;
    const finished = hydrated.filter((row) => row.isFinished).length;
    const approvedUnused = hydrated.filter((row) => row.status === "approved" && !row.isFinished).length;
    const scheduled = hydrated.filter((row) => row.scheduleCount > 0).length;
    const lowQueueThreshold = Number(process.env.ADMIN_QUEUE_LOW_THRESHOLD ?? 7);

    return NextResponse.json({
      ok: true,
      items,
      total: filtered.length,
      page,
      pageSize,
      queueHealth: {
        runwayDays: approvedUnused,
        approved,
        approvedUnused,
        scheduled,
        pending,
        finished,
        total: hydrated.length,
        lowQueueThreshold,
        isLow: approvedUnused < lowQueueThreshold,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Equadle admin data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      action?: string;
      equation?: string;
    };

    const action = payload.action ?? "add-puzzle";
    const supabase = getSupabaseEquadleAdmin();

    if (action === "add-puzzle") {
      const equation = validateEquation(payload.equation ?? "", 8);
      const { data, error } = await supabase
        .from("puzzles")
        .insert({
          equation,
          equation_length: 8,
          status: "pending_review",
        })
        .select("id,equation,equation_length,created_at,status")
        .single();

      if (error) {
        throw new Error(`Failed to add puzzle: ${error.message}`);
      }

      return NextResponse.json({ ok: true, item: data });
    }

    if (action === "generate-random") {
      let lastInsertError: Error | null = null;

      for (let attempt = 0; attempt < 40; attempt += 1) {
        const equation = generateRandomEquation(8);
        const { data, error } = await supabase
          .from("puzzles")
          .insert({
            equation,
            equation_length: 8,
            status: "pending_review",
          })
          .select("id,equation,equation_length,created_at,status")
          .single();

        if (!error) {
          return NextResponse.json({ ok: true, item: data });
        }

        if (error.code === "23505") {
          continue;
        }

        lastInsertError = new Error(`Failed to add generated puzzle: ${error.message}`);
        break;
      }

      if (lastInsertError) {
        throw lastInsertError;
      }
      throw new Error("Could not save a unique generated equation");
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Equadle admin data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { puzzleId?: string; status?: CandidateStatus };
    const puzzleId = String(payload.puzzleId || "");
    const status = String(payload.status || "") as CandidateStatus;
    if (!puzzleId || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reviewedAt = status === "pending_review" ? null : new Date().toISOString();
    const supabase = getSupabaseEquadleAdmin();
    const { error } = await supabase
      .from("puzzles")
      .update({ status, reviewed_at: reviewedAt })
      .eq("id", puzzleId);

    if (error) {
      throw new Error(`Failed to update puzzle status: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Equadle candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { id?: string };
    const id = String(payload.id || "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabaseEquadleAdmin();
    const { error: scheduleError } = await supabase.from("daily_schedule").delete().eq("puzzle_id", id);
    if (scheduleError) {
      throw new Error(`Failed deleting schedule rows: ${scheduleError.message}`);
    }

    const { error: deleteError } = await supabase.from("puzzles").delete().eq("id", id);
    if (deleteError) {
      throw new Error(`Failed deleting puzzle: ${deleteError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete Equadle candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
