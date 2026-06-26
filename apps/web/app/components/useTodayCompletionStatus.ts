"use client";

import { useEffect, useState } from "react";

type CompletionStatusResponse = {
  status?: Record<string, boolean>;
};

type TodayCompletionRecordedEvent = CustomEvent<{
  gameSlug?: string;
  puzzleDate?: string;
}>;

export function useTodayCompletionStatus() {
  const [completedGames, setCompletedGames] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    const loadCompletionStatus = async () => {
      try {
        const response = await fetch("/api/completions/today", { cache: "no-store" });
        const payload = (await response.json()) as CompletionStatusResponse & { error?: string };
        if (!response.ok || payload.error) {
          throw new Error(payload.error || "Failed to load completion status");
        }
        if (isMounted) {
          setCompletedGames(payload.status ?? {});
        }
      } catch {
        if (isMounted) {
          setCompletedGames({});
        }
      }
    };

    void loadCompletionStatus();

    const handleTodayCompletionRecorded = (event: Event) => {
      const { gameSlug } = (event as TodayCompletionRecordedEvent).detail ?? {};
      if (gameSlug) {
        setCompletedGames((current) => ({ ...current, [gameSlug]: true }));
      }
      void loadCompletionStatus();
    };

    window.addEventListener("dailydabble:today-completion-recorded", handleTodayCompletionRecorded);

    return () => {
      isMounted = false;
      window.removeEventListener("dailydabble:today-completion-recorded", handleTodayCompletionRecorded);
    };
  }, []);

  return completedGames;
}
