"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Verble", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/verble";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Verble"
      subtitleHref="/verble"
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/verble" archiveHref="/verble/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
