"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";

import { games } from "@/lib/games";

type ResultDialogActionsProps = {
  currentGameSlug: string;
  onShare: () => void | Promise<void>;
};

const gameButtonThemes: Record<string, { start: string; end: string; shadow: string }> = {
  verble: { start: "#7a5af8", end: "#5a40cb", shadow: "rgba(90, 64, 203, 0.28)" },
  agegaple: { start: "#d87093", end: "#9e4e6d", shadow: "rgba(158, 78, 109, 0.24)" },
  doodle: { start: "#1768a6", end: "#0e4e7f", shadow: "rgba(14, 78, 127, 0.24)" },
  equadle: { start: "#eadf10", end: "#d9cb00", shadow: "rgba(157, 146, 0, 0.26)" },
  yeardle: { start: "#e03a3e", end: "#ba1a1a", shadow: "rgba(186, 26, 26, 0.24)" },
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
  const currentGame = games.find((game) => game.slug === currentGameSlug);
  const isArchiveOnlyGame = currentGame?.availability === "archive";
  const primaryHref = isArchiveOnlyGame && currentGame ? `${currentGame.href}/archive` : "/account/stats";
  const primaryLabel = isArchiveOnlyGame && currentGame ? `More ${currentGame.name}` : "Stats";

  return (
    <div className="result-modal-actions">
      <button className="admin-btn-like" type="button" onClick={() => void onShare()}>
        Share
      </button>
      <Link className="admin-btn-like" href="/">
        Home
      </Link>
      <Link
        className="admin-btn-like primary"
        href={primaryHref}
        onMouseEnter={() => setIsPrimaryHovered(true)}
        onMouseLeave={() => setIsPrimaryHovered(false)}
        onFocus={() => setIsPrimaryHovered(true)}
        onBlur={() => setIsPrimaryHovered(false)}
        style={{
          ...getPrimaryButtonStyle(currentGameSlug, isPrimaryHovered),
          whiteSpace: "nowrap",
          fontSize: primaryLabel.length >= 13 ? "0.8rem" : undefined,
          paddingInline: primaryLabel.length >= 13 ? "0.65rem" : undefined,
        }}
      >
        {primaryLabel}
      </Link>
    </div>
  );
}
