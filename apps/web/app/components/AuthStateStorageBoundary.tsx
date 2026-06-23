"use client";

import { useEffect } from "react";
import { clearLocalGameState } from "@/lib/local-game-state";

const VIEWER_STORAGE_KEY = "dailydabble:v1:viewer";

type SessionResponse = {
  user?: {
    id?: string | null;
  } | null;
};

export default function AuthStateStorageBoundary() {
  useEffect(() => {
    let isMounted = true;

    const syncViewer = async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      if (!isMounted || !response?.ok) return;

      const payload = (await response.json().catch(() => ({ user: null }))) as SessionResponse;
      const nextViewer = payload.user?.id ? `user:${payload.user.id}` : "guest";
      const previousViewer = window.localStorage.getItem(VIEWER_STORAGE_KEY);

      if (previousViewer && previousViewer !== nextViewer) {
        clearLocalGameState();
        window.localStorage.setItem(VIEWER_STORAGE_KEY, nextViewer);
        window.location.reload();
        return;
      }

      window.localStorage.setItem(VIEWER_STORAGE_KEY, nextViewer);
    };

    void syncViewer();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
