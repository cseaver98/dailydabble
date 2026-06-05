"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
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
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "/", brand: true },
            { label: "Today", href: "/equadle", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/equadle/archive" },
          ]}
        />
      }
    />
  );
}
