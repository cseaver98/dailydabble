import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const allowedEquation = /^[0-9+\-*/=]+$/;

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

const validateEquation = (raw: string, expectedLength = 9): string => {
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

export async function GET() {
  try {
    const supabase = getSupabaseEquadleAdmin();

    const [puzzlesResult, scheduleResult] = await Promise.all([
      supabase.from("puzzles").select("id,equation,equation_length,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("daily_schedule").select("puzzle_date,puzzle_id,created_at").order("puzzle_date", { ascending: false }).limit(200),
    ]);

    if (puzzlesResult.error) {
      throw new Error(`Failed to load Equadle puzzles: ${puzzlesResult.error.message}`);
    }

    if (scheduleResult.error) {
      throw new Error(`Failed to load Equadle schedule: ${scheduleResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      puzzles: puzzlesResult.data ?? [],
      schedule: scheduleResult.data ?? [],
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
      puzzleId?: string;
      puzzleDate?: string;
    };

    const action = payload.action ?? "add-puzzle";
    const supabase = getSupabaseEquadleAdmin();

    if (action === "add-puzzle") {
      const equation = validateEquation(payload.equation ?? "", 9);
      const { data, error } = await supabase
        .from("puzzles")
        .insert({
          equation,
          equation_length: 9,
        })
        .select("id,equation,equation_length,created_at")
        .single();

      if (error) {
        throw new Error(`Failed to add puzzle: ${error.message}`);
      }

      return NextResponse.json({ ok: true, item: data });
    }

    if (action === "assign-date") {
      const puzzleId = payload.puzzleId ?? "";
      const puzzleDate = payload.puzzleDate ?? "";
      if (!puzzleId || !isDateString(puzzleDate)) {
        return NextResponse.json({ error: "Missing puzzleId or invalid puzzleDate" }, { status: 400 });
      }

      const { error } = await supabase
        .from("daily_schedule")
        .upsert({ puzzle_date: puzzleDate, puzzle_id: puzzleId }, { onConflict: "puzzle_date" });

      if (error) {
        throw new Error(`Failed to assign date: ${error.message}`);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Equadle admin data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
