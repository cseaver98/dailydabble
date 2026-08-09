import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../../components/AccountNav";
import DailyDabbleWordmark from "../../components/DailyDabbleWordmark";
import SiteMenu from "../../components/SiteMenu";
import AccountLoginPanel from "../AccountLoginPanel";
import { getAccountStats } from "@/lib/account-stats";
import { dailyGames } from "@/lib/games";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";

export const metadata: Metadata = {
  title: "Verble Stats",
  description: "View your Verble streak and game stats.",
  robots: { index: false, follow: false },
};

const formatPercent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const formatNumber = (value: number | null) => (value === null ? "—" : value.toString());
const formatAverage = (value: number | null) => (value === null ? "—" : value.toFixed(value % 1 === 0 ? 0 : 1));

export default async function AccountStatsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
        <main className="min-h-screen bg-transparent px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
          <AccountLoginPanel />
        </main>
      </>
    );
  }

  const stats = await getAccountStats(user.id);
  const verble = dailyGames[0];
  const gameStats = stats.games.find((game) => game.gameSlug === "verble") ?? null;
  const completedToday = stats.overall.completedTodayCount > 0;
  const streakDays = stats.overall.currentDailyDabbleStreak;

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-5xl">
          <section className={`relative overflow-hidden rounded-[2.25rem] p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10 ${completedToday ? "border border-[#cfc5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f3f0ff_100%)]" : "bg-white"}`}>
            {completedToday ? (
              <span className="absolute right-7 top-7 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e9e3ff] text-xl font-black text-[#5a40cb]" aria-hidden="true">✓</span>
            ) : null}
            <p className="font-headline text-sm font-extrabold text-[#5a40cb]">Today&apos;s Verble</p>
            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-headline text-4xl font-extrabold text-[#2c2f31] sm:text-5xl">
                  {completedToday ? "Completed" : "Ready to play"}
                </p>
                <p className="mt-2 max-w-xl text-sm font-semibold text-[#595c5e]">
                  {completedToday ? "You solved today's phrase. Come back tomorrow for a new Verble." : "Solve today's phrase to keep your streak moving."}
                </p>
              </div>
              <Link href="/verble" className="font-headline inline-flex h-11 items-center justify-center rounded-full bg-[#6d44c5] px-6 text-sm font-extrabold text-white transition hover:bg-[#5a40cb]">
                {completedToday ? "Review Verble" : "Play Verble"}
              </Link>
            </div>
          </section>

          <section className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#6d44c5_0%,#4b2ca8_100%)] p-6 text-white shadow-[0_18px_36px_rgba(90,64,203,0.22)] sm:p-7">
            <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <p className="font-headline text-sm font-extrabold text-[#eee9ff]">Verble streak</p>
            <p className="absolute right-6 top-6 z-10 text-right text-sm font-extrabold text-[#eee9ff] sm:right-7 sm:top-7">
              Your best: {stats.overall.bestDailyDabbleStreak} {stats.overall.bestDailyDabbleStreak === 1 ? "day" : "days"}
            </p>
            <div className="relative mt-3 flex items-end gap-3">
              <p className="font-headline text-6xl font-extrabold">{streakDays} 🔥</p>
              <p className="pb-2 text-lg font-extrabold text-[#eee9ff]">{streakDays === 1 ? "day" : "days"}</p>
            </div>
            <p className="relative mt-3 max-w-sm text-sm font-semibold text-white/80">Complete the daily Verble on consecutive puzzle dates to keep it going.</p>
          </section>

          <h1 className="font-headline mt-7 px-2 text-3xl font-extrabold text-[#2c2f31]">Your Verble stats</h1>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Games played", stats.overall.played.toString()],
              ["Wins", stats.overall.wins.toString()],
              ["Win rate", formatPercent(stats.overall.winRate)],
              ["Average guesses", formatAverage(stats.overall.averageGuesses)],
            ].map(([label, value]) => (
              <section key={label} className="rounded-[1.75rem] bg-white p-5 text-center shadow-[0_16px_32px_rgba(44,47,49,0.05)] sm:text-left">
                <p className="whitespace-nowrap text-sm font-bold text-[#75777a]">{label}</p>
                <p className="font-headline mt-2 text-4xl font-extrabold text-[#2c2f31]">{value}</p>
              </section>
            ))}
          </div>

          {gameStats && verble ? (
            <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)] sm:p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: verble.iconBackground }}>
                  <Image src={verble.iconSrc} alt={verble.iconAlt} width={38} height={38} className="h-9 w-9 object-contain" />
                </span>
                <div>
                  <p className="font-headline text-2xl font-extrabold text-[#5a40cb]">Verble breakdown</p>
                  <p className="text-sm font-semibold text-[#75777a]">Your daily phrase results</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Played", gameStats.dailyPlayed.toString()],
                  ["Wins", gameStats.wins.toString()],
                  ["Best guess", formatNumber(gameStats.bestGuesses)],
                  ["Average", formatAverage(gameStats.averageGuesses)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-[#f5f3ff] px-4 py-4 text-center">
                    <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">{label}</p>
                    <p className="font-headline mt-1 text-2xl font-extrabold text-[#2c2f31]">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {stats.entitlements.advancedStats ? (
            <section className="mt-6 rounded-[2rem] border border-[#d8dce2] bg-[#eff1f4]/75 p-6">
              <p className="font-headline text-xl font-extrabold text-[#2c2f31]"><DailyDabbleWordmark plus className="text-[1em]" /> stats unlocked</p>
              <p className="mt-2 text-sm font-semibold text-[#595c5e]">Your account has access to subscriber-only stat areas as they roll out.</p>
            </section>
          ) : null}
        </section>
      </main>
    </>
  );
}
