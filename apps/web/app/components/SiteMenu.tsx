"use client";

import { games } from "@/lib/games";
import { DailydabbleMenu } from "@dailydabble/ui";
import { useTodayCompletionStatus } from "./useTodayCompletionStatus";

export default function SiteMenu() {
  const completedGames = useTodayCompletionStatus();

  return (
    <DailydabbleMenu
      buttonId="siteMenuToggleBtn"
      menuId="siteNavMenu"
      items={[
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
