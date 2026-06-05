"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Sportle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/sportle";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Sportle"
      subtitleHref="/sportle"
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
            { label: "Today", href: "/sportle", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/sportle/archive" },
          ]}
        />
      }
    />
  );
}
