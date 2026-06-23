import type { Metadata } from "next";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../../components/AccountNav";
import SiteMenu from "../../components/SiteMenu";
import AccountLoginPanel from "../AccountLoginPanel";
import { getAccountStats } from "@/lib/account-stats";
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
                Complete every daily game to build your total DailyDabble streak.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Daily games played", stats.overall.played.toString()],
              ["Wins", stats.overall.wins.toString()],
              ["Win rate", formatPercent(stats.overall.winRate)],
              ["DailyDabble streak 🔥", stats.overall.currentDailyDabbleStreak.toString()],
            ].map(([label, value]) => (
              <section key={label} className="rounded-[1.75rem] bg-white p-5 shadow-[0_16px_32px_rgba(44,47,49,0.05)]">
                <p className="text-sm font-bold text-[#75777a]">{label}</p>
                <p className="font-headline mt-2 text-4xl font-extrabold text-[#2c2f31]">{value}</p>
              </section>
            ))}
          </div>

          <div className="mt-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)]">
              <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Game Breakdown</p>
              <div className="mt-5 grid gap-3">
                {stats.games.map((gameStat) => (
                  <div key={gameStat.gameSlug} className="grid gap-3 rounded-2xl border border-[#e0e3e6] bg-[#fdfefe] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{gameStat.gameName}</p>
                      <p className="mt-1 text-sm font-semibold text-[#75777a]">
                        {gameStat.played
                          ? `${gameStat.played} daily played • ${formatPercent(gameStat.winRate)} wins`
                          : gameStat.archivePlayed
                            ? `${gameStat.archivePlayed} archive played`
                            : "No daily games played yet"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:w-72">
                      <div className="rounded-xl bg-[#f5f6f9] px-3 py-2">
                        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Best</p>
                        <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{formatNumber(gameStat.bestGuesses)}</p>
                      </div>
                      <div className="rounded-xl bg-[#f5f6f9] px-3 py-2">
                        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Avg</p>
                        <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{formatAverage(gameStat.averageGuesses)}</p>
                      </div>
                      <div className="rounded-xl bg-[#f5f6f9] px-3 py-2">
                        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Streak 🔥</p>
                        <p className="font-headline text-lg font-extrabold text-[#2c2f31]">{gameStat.currentStreak}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-[2rem] border border-[#d8dce2] bg-[#eff1f4]/75 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-headline text-xl font-extrabold text-[#2c2f31]">Advanced stats are coming later</p>
                <p className="mt-2 text-sm font-semibold text-[#595c5e]">
                  Percentile graphs, badge progress, and deeper breakdowns will live here when we add subscribers.
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
