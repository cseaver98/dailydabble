"use client";

import { useState } from "react";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "./AccountNav";
import AuthDialog from "./AuthDialog";

type GameAccountGateProps = {
  gameName: string;
};

export default function GameAccountGate({ gameName }: GameAccountGateProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(true);

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#d8dce2] bg-white p-8 text-center shadow-[0_20px_40px_rgba(44,47,49,0.06)]">
          <p className="font-headline text-xs font-extrabold uppercase tracking-[0.18em] text-[#2f672d]">DailyDabble</p>
          <h1 className="font-headline mt-3 text-4xl font-extrabold leading-tight text-[#2c2f31]">
            Create an account to keep playing
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base font-semibold leading-relaxed text-[#595c5e]">
            You have completed your free games. Sign in to play {gameName} and keep your stats.
          </p>
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="font-headline mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
          >
            Sign in to continue
          </button>
          <a
            href="/"
            className="mt-4 inline-block text-sm font-bold text-[#595c5e] underline decoration-[#abadb0] underline-offset-4 transition hover:text-[#2c2f31]"
          >
            Back to hub
          </a>
        </section>
      </main>
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} mode="gate" />
    </>
  );
}
