"use client";

import { useEffect, useState } from "react";

type CompletionStatusResponse = {
  status?: Record<string, boolean>;
};

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

    return () => {
      isMounted = false;
    };
  }, []);

  return completedGames;
}
