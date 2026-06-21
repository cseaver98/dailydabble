import type { Metadata } from "next";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../../components/AccountNav";
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
        <DailydabbleNav headerClassName="hub-nav" rightContent={<AccountNav />} />
        <main className="min-h-screen bg-transparent px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
          <AccountLoginPanel />
        </main>
      </>
    );
  }

  const stats = await getAccountStats(user.id);
  const displayName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Dabbler";
  const email = user.email ?? "Private email";
  const completedTodayLabel = `${stats.overall.completedTodayCount}/${stats.overall.totalGamesToday}`;
  const topGames = stats.games.filter((game) => game.played > 0).sort((a, b) => b.played - a.played).slice(0, 3);

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-white p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#b6f6ab]/55 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-28 left-12 h-56 w-56 rounded-full bg-[#fbe276]/45 blur-2xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="font-headline text-xs font-extrabold uppercase tracking-[0.18em] text-[#2f672d]">DailyDabble Stats</p>
                <h1 className="font-headline mt-3 text-4xl font-extrabold leading-tight text-[#2c2f31] sm:text-6xl">
                  {displayName}
                </h1>
                <p className="mt-3 max-w-xl text-base font-semibold text-[#595c5e] sm:text-lg">
                  Signed in as {email}. Your progress, streaks, and game breakdowns are connected to this account.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#d8dce2] bg-[#f5f6f9]/80 p-5">
                <p className="font-headline text-sm font-extrabold text-[#2f672d]">Today&apos;s progress</p>
                <div className="mt-3 flex items-end justify-between gap-4">
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
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Daily games", stats.overall.played.toString()],
              ["Wins", stats.overall.wins.toString()],
              ["Win rate", formatPercent(stats.overall.winRate)],
              ["DailyDabble streak", stats.overall.currentDailyDabbleStreak.toString()],
            ].map(([label, value]) => (
              <section key={label} className="rounded-[1.75rem] bg-white p-5 shadow-[0_16px_32px_rgba(44,47,49,0.05)]">
                <p className="text-sm font-bold text-[#75777a]">{label}</p>
                <p className="font-headline mt-2 text-4xl font-extrabold text-[#2c2f31]">{value}</p>
              </section>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Basic Stats</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#595c5e]">
                    A simple snapshot for now. Advanced stats can plug into this stats area later.
                  </p>
                </div>
                <span className="rounded-full bg-[#eff1f4] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#595c5e]">
                  Free
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-[#f5f6f9] px-4 py-3">
                  <span className="font-bold text-[#595c5e]">Average guesses</span>
                  <span className="font-headline text-xl font-extrabold text-[#2c2f31]">{formatAverage(stats.overall.averageGuesses)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#f5f6f9] px-4 py-3">
                  <span className="font-bold text-[#595c5e]">Daily games played</span>
                  <span className="font-headline text-xl font-extrabold text-[#2c2f31]">{stats.overall.dailyPlayed}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#f5f6f9] px-4 py-3">
                  <span className="font-bold text-[#595c5e]">Archive games played</span>
                  <span className="font-headline text-xl font-extrabold text-[#2c2f31]">{stats.overall.archivePlayed}</span>
                </div>
              </div>
            </section>

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
                        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-[#75777a]">Streak</p>
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
              <span className="font-headline rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#2f672d]">
                Advanced: {stats.entitlements.advancedStats ? "On" : "Locked"}
              </span>
            </div>
          </section>

          {topGames.length ? (
            <section className="mt-6 text-center text-sm font-semibold text-[#75777a]">
              Most played: {topGames.map((game) => game.gameName).join(", ")}
            </section>
          ) : null}
        </section>
      </main>
    </>
  );
}
