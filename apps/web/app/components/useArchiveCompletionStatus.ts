"use client";

import { useEffect, useMemo, useState } from "react";

type ArchiveCompletionResponse = {
  completedDates?: string[];
  error?: string;
};

export default function useArchiveCompletionStatus(gameSlug: string, puzzleDates: string[]) {
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  const dateKey = useMemo(() => puzzleDates.join("|"), [puzzleDates]);

  useEffect(() => {
    if (!puzzleDates.length) {
      setCompletedDates(new Set());
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/completions/archive?gameSlug=${encodeURIComponent(gameSlug)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as ArchiveCompletionResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load archive completion status");
        }
        if (!active) return;
        setCompletedDates(new Set(Array.isArray(payload.completedDates) ? payload.completedDates : []));
      } catch (error) {
        if (!active) return;
        console.warn(error instanceof Error ? error.message : "Failed to load archive completion status");
        setCompletedDates(new Set());
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [dateKey, gameSlug, puzzleDates.length]);

  return completedDates;
}
