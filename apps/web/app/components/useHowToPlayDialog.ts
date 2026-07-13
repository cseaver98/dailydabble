"use client";

import { useEffect, useState } from "react";
import type { HowToPlayGame } from "./HowToPlayDialog";

const TUTORIAL_VERSION = 1;

const getStorageKey = (game: HowToPlayGame) =>
  `dailydabble:how-to-play:${game}:v${TUTORIAL_VERSION}`;

export default function useHowToPlayDialog(game: HowToPlayGame, ready: boolean) {
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      if (!ready) {
        setIsHowToPlayOpen(false);
        return;
      }

      try {
        if (window.localStorage.getItem(getStorageKey(game)) !== "seen") {
          setIsHowToPlayOpen(true);
        }
      } catch {
        // Storage can be unavailable in privacy modes; the manual button still works.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [game, ready]);

  const openHowToPlay = () => setIsHowToPlayOpen(true);
  const closeHowToPlay = () => {
    try {
      window.localStorage.setItem(getStorageKey(game), "seen");
    } catch {
      // Closing the dialog should never depend on storage access.
    }
    setIsHowToPlayOpen(false);
  };

  return { isHowToPlayOpen, openHowToPlay, closeHowToPlay };
}
