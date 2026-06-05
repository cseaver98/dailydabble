"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
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
      rightContent={
        <DailydabbleMenu
          buttonId="menuToggleBtn"
          menuId="navMenu"
          items={[
            { label: "DailyDabble", href: "/", brand: true },
            { label: "Today", href: "/yeardle", id: "todayGameBtn", hidden: hideTodayOption },
            { label: "Archive games", href: "/yeardle/archive" },
          ]}
        />
      }
    />
  );
}
