"use client";

import { useEffect, useRef, useState } from "react";

import type { EditorialContext } from "@/lib/agegaple/types";

type EditorialDrawerProps = {
  context: EditorialContext;
  personAName: string;
  personBName: string;
  isDarkMode: boolean;
};

export default function EditorialDrawer({
  context,
  personAName,
  personBName,
  isDarkMode,
}: EditorialDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl border text-sm ${
        isDarkMode ? "border-zinc-700 bg-zinc-800/50 text-zinc-200" : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] text-[color:var(--foreground)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <p className="font-semibold">Editorial content</p>
        <span
          className={`text-[color:var(--primary)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 14 12 8l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full left-0 right-0 z-[80] mb-2 rounded-2xl border shadow-2xl ${
            isDarkMode ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-[color:var(--surface-container)] bg-white text-[color:var(--foreground)]"
          }`}
        >
          <div className={`flex items-center justify-between border-b px-4 py-3 ${isDarkMode ? "border-zinc-700" : "border-[color:var(--surface-container)]"}`}>
            <p className="font-semibold">Editorial content</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                isDarkMode ? "text-zinc-400 hover:text-zinc-200" : "text-[color:var(--outline)] hover:text-[color:var(--primary-dim)]"
              }`}
            >
              Close
            </button>
          </div>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto px-4 pb-4 pt-3">
            <p>{context.relationshipNote}</p>
            {context.coupleContext && (
              <p>
                {context.coupleContext}
              </p>
            )}
            {context.personABio && (
              <p>
                <span className="font-semibold">{personAName}:</span> {context.personABio}
              </p>
            )}
            {context.personBBio && (
              <p>
                <span className="font-semibold">{personBName}:</span> {context.personBBio}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
