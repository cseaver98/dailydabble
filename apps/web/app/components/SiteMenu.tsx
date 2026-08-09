"use client";

import { dailyGames, games, getGamePlayHref } from "@/lib/games";
import { DailydabbleMenu } from "@dailydabble/ui";
import { useTodayCompletionStatus } from "./useTodayCompletionStatus";
import { useNextGameCountdown } from "@/lib/use-next-game-countdown";

export default function SiteMenu() {
  const { completedGames } = useTodayCompletionStatus();
  const completedCount = dailyGames.filter((game) => completedGames[game.slug]).length;
  const dailyComplete = completedCount === dailyGames.length;
  const nextGameCountdown = useNextGameCountdown(dailyComplete);

  return (
    <DailydabbleMenu
      buttonId="siteMenuToggleBtn"
      menuId="siteNavMenu"
      progressSummary={{
        label: "Today",
        completed: completedCount,
        total: dailyGames.length,
        ariaLabel: completedCount ? "Today's Verble completed" : "Today's Verble not completed",
        progressMessage: dailyComplete ? undefined : "Solve today's Verble phrase.",
        completionTitle: dailyComplete ? "Today's Verble complete!" : undefined,
        completionMessage: dailyComplete ? "Come back tomorrow for a new phrase." : undefined,
        completionCountdown: dailyComplete ? `New Verble in ${nextGameCountdown || "--:--:--"}` : undefined,
        completionActionLabel: dailyComplete ? "Remind me" : undefined,
        completionActionHref: dailyComplete ? "/account#email-preferences" : undefined,
      }}
      items={[
        ...games.map((game) => ({
          label: game.name,
          href: getGamePlayHref(game),
          archiveHref: game.availability === "daily" ? `${game.href}/archive` : undefined,
          iconSrc: game.iconSrc,
          iconAlt: game.iconAlt,
          iconBackground: game.iconBackground,
          completed: game.availability === "daily" && Boolean(completedGames[game.slug]),
          statusLabel: game.availability === "archive"
            ? "Archive"
            : completedGames[game.slug] ? "Completed" : "Not done",
          statusTone: game.availability === "daily" && completedGames[game.slug] ? "done" : "neutral",
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
