"use client";

import { games } from "@/lib/games";
import { DailydabbleMenu } from "@dailydabble/ui";
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

  return (
    <DailydabbleMenu
      buttonId={buttonId}
      menuId={menuId}
      items={[
        { label: "Today", href: todayHref, id: "todayGameBtn", hidden: hideToday, iconBackground: currentGame?.iconBackground },
        { label: "Archive games", href: archiveHref, iconBackground: currentGame?.iconBackground },
        ...games.map((game) => ({
          label: game.name,
          href: game.href,
          iconSrc: game.iconSrc,
          iconAlt: game.iconAlt,
          iconBackground: game.iconBackground,
          completed: Boolean(completedGames[game.slug]),
        })),
      ]}
    />
  );
}
