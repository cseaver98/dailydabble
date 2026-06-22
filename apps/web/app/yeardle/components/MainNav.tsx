"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Yeardle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/yeardle";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Yeardle"
      subtitleHref="/yeardle"
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/yeardle" archiveHref="/yeardle/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
