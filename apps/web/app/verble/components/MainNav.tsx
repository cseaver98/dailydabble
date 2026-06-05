"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
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
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "/", brand: true },
            { label: "Today", href: "/verble", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/verble/archive" },
          ]}
        />
      }
    />
  );
}
