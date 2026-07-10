"use client";

import { games } from "@/lib/games";
import { DailydabbleMenu } from "@dailydabble/ui";
import { useTodayCompletionStatus } from "./useTodayCompletionStatus";

export default function SiteMenu() {
  const { completedGames } = useTodayCompletionStatus();
  const completedCount = games.filter((game) => completedGames[game.slug]).length;

  return (
    <DailydabbleMenu
      buttonId="siteMenuToggleBtn"
      menuId="siteNavMenu"
      progressSummary={{
        label: "Today",
        completed: completedCount,
        total: games.length,
        ariaLabel: `${completedCount} of ${games.length} games completed today`,
      }}
      items={[
        ...games.map((game) => ({
          label: game.name,
          href: game.href,
          archiveHref: `${game.href}/archive`,
          iconSrc: game.iconSrc,
          iconAlt: game.iconAlt,
          iconBackground: game.iconBackground,
          completed: Boolean(completedGames[game.slug]),
          statusLabel: completedGames[game.slug] ? "Completed" : "Not done",
          statusTone: completedGames[game.slug] ? "done" : "neutral",
        })),
      ]}
      legalLinks={[
        { label: "Stats", href: "/account/stats" },
        { label: "Account", href: "/account" },
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
      ]}
    />
  );
}
