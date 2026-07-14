"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import GameMenu from "../../components/GameMenu";
import AccountNav from "../../components/AccountNav";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function MainNav({ label = "Doodle", hideToday = false }) {
  const pathname = usePathname();
  const [isReplayView, setIsReplayView] = useState(false);

  useEffect(() => {
    if (pathname !== "/doodle") {
      setIsReplayView(false);
      return;
    }
    const hasReplayQuery = new URLSearchParams(window.location.search).has("replay");
    setIsReplayView(hasReplayQuery);
  }, [pathname]);

  const isOnTodaysGame = pathname === "/doodle" && !isReplayView;
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Doodle"
      subtitleHref="/doodle"
      subtitleAsHeading={pathname === "/doodle"}
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      leftContent={<GameMenu todayHref="/doodle" archiveHref="/doodle/archive" hideToday={hideTodayOption} />}
      rightContent={<AccountNav />}
    />
  );
}
