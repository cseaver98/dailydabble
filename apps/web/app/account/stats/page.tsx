import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../../components/AccountNav";
import DailyDabbleWordmark from "../../components/DailyDabbleWordmark";
import SiteMenu from "../../components/SiteMenu";
import AccountLoginPanel from "../AccountLoginPanel";
import { getAccountStats } from "@/lib/account-stats";
import { games } from "@/lib/games";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";

export const metadata: Metadata = {
  title: "Stats | DailyDabble",
  description: "View your DailyDabble game stats.",
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
  const completedTodayLabel = `${stats.overall.completedTodayCount}/${stats.overall.totalGamesToday}`;

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-white p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
            <div className="relative">
              <p className="font-headline text-sm font-extrabold text-[#2f672d]">Today&apos;s progress</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <p className="font-headline text-5xl font-extrabold text-[#2c2f31]">{completedTodayLabel}</p>
                <Link
                  href="/"
                  className="font-headline inline-flex h-11 items-center justify-center rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
                >
                  Play games
                </Link>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#595c5e]">
                Complete every daily game to build your total <DailyDabbleWordmark className="text-[1em]" /> streak 🔥.
              </p>
            </div>
          </div>

          <h2 className="font-headline mt-6 px-6 text-2xl font-extrabold text-[#2c2f31]">Stats</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
            {[
              ["Daily games played", stats.overall.played.toString()],
              ["Wins", stats.overall.wins.toString()],
              ["Win rate", formatPercent(stats.overall.winRate)],
              ["Average guesses", formatAverage(stats.overall.averageGuesses)],
              ["Current streak", `${stats.overall.currentDailyDabbleStreak} 🔥`],
              ["Best streak", `${stats.overall.bestDailyDabbleStreak} 🔥`],
            ].map(([label, value]) => (
              <section key={label} className="rounded-[1.75rem] bg-white p-5 text-center shadow-[0_16px_32px_rgba(44,47,49,0.05)] sm:text-left">
                <p className="whitespace-nowrap text-sm font-bold text-[#75777a]">{label}</p>
                <p className="font-headline mt-2 text-4xl font-extrabold text-[#2c2f31]">{value}</p>
              </section>
            ))}
          </div>

          <div className="mt-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)]">
              <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Game Breakdown</p>
              <div className="mt-5 grid gap-3">
                {stats.games.map((gameStat) => {
                  const game = games.find((item) => item.slug === gameStat.gameSlug);

                  return (
                    <div key={gameStat.gameSlug} className="grid grid-cols-2 gap-3 rounded-2xl border border-[#edf0f3] bg-[#fdfefe] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="flex min-h-[5.25rem] min-w-0 flex-col items-center justify-center gap-2 text-center sm:min-h-0 sm:flex-row sm:justify-start sm:text-left sm:gap-3">
                        {game ? (
                          <span
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: game.iconBackground }}
                          >
                            <Image
                              src={game.iconSrc}
                              alt={game.iconAlt}
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                            />
                          </span>
                        ) : null}
                        <div className="min-w-0">
                          <p className="font-headline text-base font-extrabold text-[#2c2f31] sm:text-lg">{gameStat.gameName}</p>
                        </div>
                      </div>
                      <div className="contents text-center sm:grid sm:w-[30rem] sm:grid-cols-5 sm:gap-2">
                        <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl bg-[#f5f6f9] px-3 py-2 sm:min-h-0">
                          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Played</p>
                          <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{gameStat.dailyPlayed}</p>
                        </div>
                        <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl bg-[#f5f6f9] px-3 py-2 sm:min-h-0">
                          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Wins</p>
                          <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{gameStat.wins}</p>
                        </div>
                        <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl bg-[#f5f6f9] px-3 py-2 sm:min-h-0">
                          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Rate</p>
                          <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{formatPercent(gameStat.winRate)}</p>
                        </div>
                        <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl bg-[#f5f6f9] px-3 py-2 sm:min-h-0">
                          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Best guess</p>
                          <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{formatNumber(gameStat.bestGuesses)}</p>
                        </div>
                        <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl bg-[#f5f6f9] px-3 py-2 sm:min-h-0">
                          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Avg guesses</p>
                          <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{formatAverage(gameStat.averageGuesses)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-[2rem] border border-[#d8dce2] bg-[#eff1f4]/75 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-headline text-xl font-extrabold text-[#2c2f31]">
                  {stats.entitlements.advancedStats ? <><DailyDabbleWordmark plus className="text-[1em]" /> stats unlocked</> : "Advanced stats are coming later"}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#595c5e]">
                  {stats.entitlements.advancedStats
                    ? "Your account has access to subscriber-only stat areas as they roll out."
                    : "Percentile graphs, badge progress, and deeper breakdowns will live here when we add subscribers."}
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
