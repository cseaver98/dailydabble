"use client";

import { games } from "@/lib/games";
import { trackEventOnce } from "@/lib/analytics-client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AnalyticsPageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth_success") === "1") {
      trackEventOnce("signup-completed", { eventName: "signup_completed" });
      url.searchParams.delete("auth_success");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    if (pathname === "/") {
      trackEventOnce(`page:${pathname}`, { eventName: "homepage_viewed" });
      return;
    }

    const game = games.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
    if (!game || pathname.includes("/archive")) return;

    trackEventOnce(`page:${pathname}`, {
      eventName: "game_opened",
      gameSlug: game.slug,
    });
  }, [pathname]);

  return null;
}
