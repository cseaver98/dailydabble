"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Sportle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Sportle"
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
            { label: "Archive games", href: "/archive" },
            { label: "Today", href: "/", id: "todayGameBtn", hidden: hideTodayOption },
          ]}
        />
      }
    />
  );
}
