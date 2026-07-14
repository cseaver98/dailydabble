const ALLOWED_EQUATION = /^[0-9+\-*/=]+$/;

type Operator = "+" | "-" | "*" | "/";

const precedence: Record<Operator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

const tokenizeExpression = (expr: string): string[] => {
  const tokens = expr.match(/\d+|[+\-*/]/g) || [];
  if (tokens.join("") !== expr) {
    throw new Error("Guess must be a valid equation");
  }

  if (tokens.length === 0 || /[+\-*/]/.test(tokens[0] || "") || /[+\-*/]/.test(tokens[tokens.length - 1] || "")) {
    throw new Error("Guess must be a valid equation");
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] || "";
    const shouldBeNumber = i % 2 === 0;
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
  const operators: Operator[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      output.push(token);
      continue;
    }

    const operator = token as Operator;
    while (
      operators.length > 0 &&
      precedence[operators[operators.length - 1] as Operator] >= precedence[operator]
    ) {
      output.push(operators.pop() as string);
    }
    operators.push(operator);
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

    const left = a as number;
    const right = b as number;

    let value = 0;
    if (token === "+") value = left + right;
    if (token === "-") value = left - right;
    if (token === "*") value = left * right;
    if (token === "/") {
      if (right === 0 || left % right !== 0) {
        throw new Error("Equation must be true");
      }
      value = left / right;
    }

    if (!Number.isInteger(value)) {
      throw new Error("Equation must be true");
    }

    stack.push(value);
  }

  if (stack.length !== 1 || !Number.isInteger(stack[0])) {
    throw new Error("Guess must be a valid equation");
  }

  return stack[0] as number;
};

export const evaluateExpression = (expr: string): number => {
  const tokens = tokenizeExpression(expr);
  return evalRpn(toRpn(tokens));
};

const normalizeEquationInput = (value: string): string =>
  String(value || "")
    .replace(/[xX×]/g, "*")
    .replace(/÷/g, "/");

export const validateEquation = (equation: string, expectedLength = 9): string => {
  const value = normalizeEquationInput(equation).trim();

  if (value.length !== expectedLength) {
    throw new Error(`Guess must be ${expectedLength} characters`);
  }

  if (!ALLOWED_EQUATION.test(value)) {
    throw new Error("Guess must be a valid equation");
  }

  const parts = value.split("=");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Guess must be a valid equation");
  }

  const left = evaluateExpression(parts[0]);
  const right = evaluateExpression(parts[1]);

  if (!Number.isInteger(left) || !Number.isInteger(right) || left !== right) {
    throw new Error("Equation must be true");
  }

  return value;
};

export const buildCharFeedback = (guess: string, answer: string): Array<"correct" | "present" | "absent"> => {
  const len = answer.length;
  const result: Array<"correct" | "present" | "absent"> = Array.from({ length: len }, () => "absent");
  const remaining = new Map<string, number>();

  for (let index = 0; index < len; index += 1) {
    const answerChar = answer[index] || "";
    const guessChar = guess[index] || "";

    if (guessChar === answerChar) {
      result[index] = "correct";
      continue;
    }

    remaining.set(answerChar, (remaining.get(answerChar) || 0) + 1);
  }

  for (let index = 0; index < len; index += 1) {
    if (result[index] === "correct") {
      continue;
    }

    const guessChar = guess[index] || "";
    const count = remaining.get(guessChar) || 0;
    if (count > 0) {
      result[index] = "present";
      remaining.set(guessChar, count - 1);
    }
  }

  return result;
};
