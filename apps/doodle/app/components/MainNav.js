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
      label={label}
      labelId="challengeDate"
      labelClassName="subtle nav-date"
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "Archive games", href: "/archive" },
            { label: "Today", href: "/", id: "todayGameBtn", hidden: hideTodayOption },
          ]}
          legalLinks={[
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
          ]}
        />
      }
    />
  );
}
