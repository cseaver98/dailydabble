"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Moviedle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/moviedle";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Moviedle"
      subtitleHref="/moviedle"
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/moviedle" archiveHref="/moviedle/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
