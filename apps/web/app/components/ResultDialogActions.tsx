"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";

import { games } from "@/lib/games";
import { useTodayCompletionStatus } from "./useTodayCompletionStatus";

type ResultDialogActionsProps = {
  currentGameSlug: string;
  onShare: () => void | Promise<void>;
};

const gameButtonThemes: Record<string, { start: string; end: string; shadow: string }> = {
  verble: { start: "#eadf10", end: "#d9cb00", shadow: "rgba(157, 146, 0, 0.26)" },
  agegaple: { start: "#d87093", end: "#9e4e6d", shadow: "rgba(158, 78, 109, 0.24)" },
  doodle: { start: "#1768a6", end: "#0e4e7f", shadow: "rgba(14, 78, 127, 0.24)" },
  equadle: { start: "#e03a3e", end: "#ba1a1a", shadow: "rgba(186, 26, 26, 0.24)" },
  yeardle: { start: "#7a5af8", end: "#5a40cb", shadow: "rgba(90, 64, 203, 0.28)" },
  moviedle: { start: "#0f766e", end: "#0b5a54", shadow: "rgba(11, 90, 84, 0.24)" },
  sportle: { start: "#d97b1e", end: "#a45508", shadow: "rgba(164, 85, 8, 0.24)" },
};

const statsButtonTheme = { start: "#2f672d", end: "#225b22", shadow: "rgba(34, 91, 34, 0.24)" };

const getPrimaryButtonStyle = (gameSlug: string | undefined, isHovered: boolean): CSSProperties => {
  const theme = gameSlug ? gameButtonThemes[gameSlug] : statsButtonTheme;
  return {
    background: isHovered
      ? `linear-gradient(135deg, ${theme.end}, ${theme.end})`
      : `linear-gradient(135deg, ${theme.start}, ${theme.end})`,
    boxShadow: isHovered ? `0 12px 24px ${theme.shadow}` : `0 10px 20px ${theme.shadow}`,
  };
};

export default function ResultDialogActions({ currentGameSlug, onShare }: ResultDialogActionsProps) {
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  const { completedGames, isLoading } = useTodayCompletionStatus();
  const nextGame = isLoading
    ? undefined
    : games.find((game) => game.slug !== currentGameSlug && !completedGames[game.slug]);
  const hasLongNextGameLabel = Boolean(nextGame && nextGame.name.length >= 8);

  return (
    <div className="result-modal-actions">
      <button className="admin-btn-like" type="button" onClick={() => void onShare()}>
        Share
      </button>
      <Link className="admin-btn-like" href="/">
        All Games
      </Link>
      {isLoading ? (
        <span
          aria-disabled="true"
          className="admin-btn-like cursor-wait bg-white"
        >
          Loading...
        </span>
      ) : (
        <Link
          className="admin-btn-like primary"
          href={nextGame ? nextGame.href : "/account/stats"}
          onMouseEnter={() => setIsPrimaryHovered(true)}
          onMouseLeave={() => setIsPrimaryHovered(false)}
          onFocus={() => setIsPrimaryHovered(true)}
          onBlur={() => setIsPrimaryHovered(false)}
          style={{
            ...getPrimaryButtonStyle(nextGame?.slug ?? currentGameSlug, isPrimaryHovered),
            whiteSpace: "nowrap",
            fontSize: hasLongNextGameLabel ? "0.8rem" : undefined,
            paddingInline: hasLongNextGameLabel ? "0.65rem" : undefined,
          }}
        >
          {nextGame ? (
            <>
              Next Game
              <span className="mx-1.5 h-4 w-px bg-current opacity-55" aria-hidden="true" />
              {nextGame.name}
            </>
          ) : "Stats"}
        </Link>
      )}
    </div>
  );
}
