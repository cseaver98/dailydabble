"use client";

import { games } from "@/lib/games";
import { DailydabbleMenu } from "@dailydabble/ui";
import { usePathname } from "next/navigation";
import { useTodayCompletionStatus } from "./useTodayCompletionStatus";

type GameMenuProps = {
  todayHref: string;
  archiveHref: string;
  hideToday?: boolean;
  buttonId?: string;
  menuId?: string;
};

export default function GameMenu({
  todayHref,
  archiveHref,
  hideToday = false,
  buttonId = "menuToggleBtn",
  menuId = "navMenu",
}: GameMenuProps) {
  const currentGame = games.find((game) => game.href === todayHref);
  const completedGames = useTodayCompletionStatus();
  const completedCount = games.filter((game) => completedGames[game.slug]).length;
  const pathname = usePathname();
  const hideTodayOption = hideToday || pathname?.startsWith(archiveHref);

  return (
    <DailydabbleMenu
      buttonId={buttonId}
      menuId={menuId}
      progressSummary={{
        label: "Today",
        completed: completedCount,
        total: games.length,
        ariaLabel: `${completedCount} of ${games.length} games completed today`,
      }}
      items={[
        { label: "Today", href: todayHref, id: "todayGameBtn", hidden: hideTodayOption, iconBackground: currentGame?.iconBackground },
        ...games.map((game) => ({
          label: game.name,
          href: game.href,
          archiveHref: game.href === todayHref ? archiveHref : `${game.href}/archive`,
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
