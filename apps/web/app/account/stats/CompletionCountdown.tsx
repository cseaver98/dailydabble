"use client";

import { useNextGameCountdown } from "@/lib/use-next-game-countdown";

export default function CompletionCountdown() {
  const countdown = useNextGameCountdown(true);

  return (
    <p className="font-headline mt-3 inline-flex rounded-full bg-[#d1ffc7] px-3 py-1.5 text-xs font-extrabold text-[#225b22]">
      New games in {countdown || "--:--:--"}
    </p>
  );
}
