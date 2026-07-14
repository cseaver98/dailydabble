"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Sportle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/sportle";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Sportle"
      subtitleHref="/sportle"
      subtitleAsHeading={isOnTodaysGame}
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/sportle" archiveHref="/sportle/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
