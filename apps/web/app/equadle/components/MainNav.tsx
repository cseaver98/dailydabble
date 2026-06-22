"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Equadle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/equadle";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Equadle"
      subtitleHref="/equadle"
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/equadle" archiveHref="/equadle/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
