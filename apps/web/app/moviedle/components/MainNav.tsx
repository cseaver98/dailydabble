"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
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
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "/", brand: true },
            { label: "Today", href: "/moviedle", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/moviedle/archive" },
          ]}
        />
      }
    />
  );
}
