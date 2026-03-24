"use client";

import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { usePathname } from "next/navigation";

export default function MainNav({ label = "Yeardle", hideToday = false }) {
  const pathname = usePathname();
  const isOnTodaysGame = pathname === "/";
  const hideTodayOption = hideToday || isOnTodaysGame;

  return (
    <DailydabbleNav
      subtitle="Yeardle"
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
