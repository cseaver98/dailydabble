"use client";

import Link from "next/link";
import { useNextGameCountdown } from "@/lib/use-next-game-countdown";

export default function CompletionCountdown() {
  const countdown = useNextGameCountdown(true);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p className="font-headline inline-flex rounded-full bg-[#d1ffc7] px-3 py-1.5 text-xs font-extrabold text-[#225b22]">
        New games in {countdown || "--:--:--"}
      </p>
      <Link
        className="font-headline inline-flex rounded-full border border-[#b6f6ab] bg-white px-3 py-1.5 text-xs font-extrabold text-[#225b22] transition hover:bg-[#f0ffed]"
        href="/account#email-preferences"
      >
        Remind me
      </Link>
    </div>
  );
}
