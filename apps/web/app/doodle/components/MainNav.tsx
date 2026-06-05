"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
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
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="/"
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "/", brand: true },
            { label: "Today", href: "/doodle", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/doodle/archive" },
          ]}
        />
      }
    />
  );
}
