"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "./components/AccountNav";
import SiteMenu from "./components/SiteMenu";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-7 text-center shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
          <p className="font-headline text-xs font-extrabold uppercase tracking-[0.16em] text-[#b02500]">
            Something went sideways
          </p>
          <h1 className="font-headline mt-3 text-3xl font-extrabold leading-tight text-[#2c2f31] sm:text-5xl">
            DailyDabble hit a snag.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-relaxed text-[#595c5e]">
            Try again in a moment. If you were signed in, your account and saved progress should still be intact.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="font-headline inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="font-headline inline-flex h-12 items-center justify-center rounded-full bg-[#eff1f4] px-6 text-sm font-extrabold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
            >
              Back to games
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-6 text-xs font-bold text-[#75777a]">Error ID: {error.digest}</p>
          ) : null}
        </section>
      </main>
    </>
  );
}
