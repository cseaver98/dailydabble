"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function MainNav({ label = "Doodle", hideToday = false }) {
  const pathname = usePathname();
  const [isReplayView, setIsReplayView] = useState(false);

  useEffect(() => {
    if (pathname !== "/") {
      setIsReplayView(false);
      return;
    }
    const hasReplayQuery = new URLSearchParams(window.location.search).has("replay");
    setIsReplayView(hasReplayQuery);
  }, [pathname]);

  const isOnTodaysGame = pathname === "/" && !isReplayView;
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Doodle"
      subtitleHref="/"
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      homeHref="https://dailydabble.app"
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "https://dailydabble.app", brand: true },
            { label: "Today", href: "/", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/archive" },
          ]}
        />
      }
    />
  );
}
