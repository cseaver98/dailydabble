"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type Operator = "+" | "-" | "*" | "/";

type EquadleCalculatorProps = {
  isOpen: boolean;
  onClose: () => void;
};

const operatorLabels: Record<Operator, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

const calculatorKeys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", ".", "0", "=", "+"];

const calculate = (left: number, right: number, operator: Operator) => {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (right === 0) return null;
  return left / right;
};

const formatResult = (value: number) => {
  if (!Number.isFinite(value)) return "Error";
  return String(Number(value.toPrecision(12)));
};

export default function EquadleCalculator({ isOpen, onClose }: EquadleCalculatorProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const clear = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const inputDigit = (digit: string) => {
    if (display === "Error" || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    setDisplay((current) => current === "0" ? digit : `${current}${digit}`.slice(0, 14));
  };

  const inputDecimal = () => {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay((current) => `${current}.`);
  };

  const chooseOperator = (nextOperator: Operator) => {
    const inputValue = Number(display);
    if (!Number.isFinite(inputValue)) {
      clear();
      return;
    }

    if (operator && storedValue !== null && !waitingForOperand) {
      const result = calculate(storedValue, inputValue, operator);
      if (result === null) {
        setDisplay("Error");
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        return;
      }
      setDisplay(formatResult(result));
      setStoredValue(result);
    } else {
      setStoredValue(inputValue);
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const resolve = () => {
    if (!operator || storedValue === null || waitingForOperand) return;
    const result = calculate(storedValue, Number(display), operator);
    setDisplay(result === null ? "Error" : formatResult(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const backspace = () => {
    if (display === "Error" || waitingForOperand) return;
    setDisplay((current) => current.length > 1 ? current.slice(0, -1) : "0");
  };

  const requestClose = () => setIsClosing(true);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
    } else if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      inputDigit(event.key);
    } else if (["+", "-", "*", "/"].includes(event.key)) {
      event.preventDefault();
      chooseOperator(event.key as Operator);
    } else if (event.key === ".") {
      event.preventDefault();
      inputDecimal();
    } else if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      resolve();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      backspace();
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="calculator-backdrop" data-state={isClosing ? "closing" : "open"} onClick={requestClose}>
      <aside
        aria-label="Calculator"
        aria-modal="true"
        className="calculator-drawer"
        data-state={isClosing ? "closing" : "open"}
        onAnimationEnd={(event) => {
          if (isClosing && event.currentTarget === event.target) {
            setIsClosing(false);
            onClose();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="calculator-header">
          <div>
            <p className="calculator-kicker">Equadle tool</p>
            <h2>Calculator</h2>
          </div>
          <button ref={closeButtonRef} className="calculator-close" type="button" onClick={requestClose} aria-label="Close calculator">×</button>
        </div>

        <div className="calculator-display" aria-live="polite">
          <span>{operator && storedValue !== null ? `${formatResult(storedValue)} ${operatorLabels[operator]}` : ""}</span>
          <strong>{display}</strong>
        </div>

        <div className="calculator-utility-row">
          <button type="button" onClick={clear}>Clear</button>
          <button type="button" onClick={backspace} aria-label="Delete last digit">⌫</button>
        </div>

        <div className="calculator-grid">
          {calculatorKeys.map((key) => {
            const isOperator = ["+", "-", "*", "/"].includes(key);
            return (
              <button
                key={key}
                className={key === "=" ? "equals" : isOperator ? "operator" : ""}
                type="button"
                onClick={() => {
                  if (/^[0-9]$/.test(key)) inputDigit(key);
                  else if (key === ".") inputDecimal();
                  else if (key === "=") resolve();
                  else chooseOperator(key as Operator);
                }}
                aria-label={isOperator ? operatorLabels[key as Operator] : key}
              >
                {isOperator ? operatorLabels[key as Operator] : key}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
