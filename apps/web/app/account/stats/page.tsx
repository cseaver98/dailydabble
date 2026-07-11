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
import CompletionCountdown from "./CompletionCountdown";

export const metadata: Metadata = {
  title: "Stats",
  description: "View your DailyDabble game stats.",
  robots: { index: false, follow: false },
};

const formatPercent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const formatNumber = (value: number | null) => (value === null ? "—" : value.toString());
const formatAverage = (value: number | null) => (value === null ? "—" : value.toFixed(value % 1 === 0 ? 0 : 1));
const formatTrophyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
const formatTrophyMonth = (month: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
const gameAccentColors: Record<string, string> = {
  verble: "#c9b900",
  agegaple: "#b24f75",
  doodle: "#1768a6",
  equadle: "#ba1a1a",
  yeardle: "#6d44c5",
  moviedle: "#087f74",
  sportle: "#c45f08",
};

function TrophyIcon() {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20" aria-hidden="true">
      <path d="M29 17h38v18c0 14-8 25-19 25S29 49 29 35V17Z" fill="#e9b937" stroke="#7d5108" strokeWidth="3" />
      <path d="M36 21h9v28c-6-2-9-8-9-16V21Z" fill="#fff2a8" opacity=".72" />
      <path d="M29 24H17v8c0 11 7 18 18 19M67 24h12v8c0 11-7 18-18 19" fill="none" stroke="#b87c0a" strokeWidth="6" strokeLinecap="round" />
      <path d="M48 60v12M34 82h28M39 72h18v10H39z" fill="#d99e22" stroke="#7d5108" strokeWidth="3" strokeLinejoin="round" />
      <path d="m48 27 3 6 7 .9-5 4.8 1.3 6.8L48 42l-6.3 3.5 1.3-6.8-5-4.8 7-.9 3-6Z" fill="#fff6c8" />
    </svg>
  );
}

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
  const completedTodayLabel = `${stats.overall.completedTodayCount} of ${stats.overall.totalGamesToday}`;
  const allGamesComplete = stats.overall.completedTodayCount === stats.overall.totalGamesToday;
  const streakDays = stats.overall.currentDailyDabbleStreak;
  const favoriteGame = stats.favoriteGame
    ? games.find((game) => game.slug === stats.favoriteGame?.gameSlug) ?? null
    : null;

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-6xl">
          <div className={`relative overflow-hidden rounded-[2.25rem] p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10 ${allGamesComplete ? "border border-[#b6f6ab] bg-[linear-gradient(135deg,#ffffff_0%,#f0ffed_100%)]" : "bg-white"}`}>
            <div className="relative">
              <p className="font-headline text-sm font-extrabold text-[#2f672d]">Today&apos;s progress</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-headline text-5xl font-extrabold text-[#2c2f31]">{completedTodayLabel}</p>
                    <p className="mt-1 text-sm font-bold text-[#75777a]">games completed today</p>
                  </div>
                  {allGamesComplete ? (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#d1ffc7] text-xl font-black text-[#225b22]" aria-hidden="true">✓</span>
                  ) : null}
                </div>
                <Link
                  href="/"
                  className="font-headline inline-flex h-11 items-center justify-center rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
                >
                  {allGamesComplete ? "All games" : "Play games"}
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-1.5" aria-label={`${completedTodayLabel} games completed today`}>
                {Array.from({ length: stats.overall.totalGamesToday }, (_, index) => (
                  <span
                    key={index}
                    className={`h-2.5 rounded-full ${index < stats.overall.completedTodayCount ? "bg-[#2f672d]" : "bg-[#e4e7ea]"}`}
                  />
                ))}
              </div>
              {allGamesComplete ? (
                <div className="mt-4">
                  <p className="font-headline text-xl font-extrabold text-[#225b22]">Full DailyDabble completed!</p>
                  <p className="mt-1 text-sm font-semibold text-[#595c5e]">
                    You completed all seven games today. Come back tomorrow to keep your streak going.
                  </p>
                  <CompletionCountdown />
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-[#595c5e]">
                  Completing any daily game keeps your <DailyDabbleWordmark className="text-[1em]" /> streak moving.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#2f672d_0%,#1f4f25_100%)] p-6 text-white shadow-[0_18px_36px_rgba(47,103,45,0.18)] sm:p-7">
              <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#d1ffc7]/10" />
              <p className="font-headline text-sm font-extrabold text-[#d1ffc7]">DailyDabble streak</p>
              <p className="absolute right-6 top-6 z-10 text-right text-sm font-extrabold text-[#d1ffc7] sm:right-7 sm:top-7">
                Your best: {stats.overall.bestDailyDabbleStreak} {stats.overall.bestDailyDabbleStreak === 1 ? "day" : "days"}
              </p>
              <div className="relative mt-3 flex items-end gap-3">
                <p className="font-headline text-6xl font-extrabold">{streakDays} 🔥</p>
                <p className="pb-2 text-lg font-extrabold text-[#d1ffc7]">{streakDays === 1 ? "day" : "days"}</p>
              </div>
              <p className="relative mt-3 max-w-sm text-sm font-semibold text-white/80">
                Complete at least one daily game each day to keep it going.
              </p>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)] sm:p-7">
              <p className="font-headline text-sm font-extrabold text-[#75777a]">Favorite game</p>
              {stats.favoriteGame && favoriteGame ? (
                <div className="mt-4 flex items-center gap-4">
                  <span
                    className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem]"
                    style={{ backgroundColor: favoriteGame.iconBackground }}
                  >
                    <Image src={favoriteGame.iconSrc} alt={favoriteGame.iconAlt} width={42} height={42} className="h-10 w-10 object-contain" />
                  </span>
                  <div>
                    <p className="font-headline text-3xl font-extrabold" style={{ color: gameAccentColors[favoriteGame.slug] }}>
                      {favoriteGame.name}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#595c5e]">
                      {stats.favoriteGame.totalCompletions} daily {stats.favoriteGame.totalCompletions === 1 ? "completion" : "completions"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">No favorite yet</p>
                  <p className="mt-2 text-sm font-semibold text-[#595c5e]">Complete a daily game to get started.</p>
                </div>
              )}
            </section>
          </div>

          <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#fffdf6_0%,#fff7d9_100%)] p-6 shadow-[0_18px_36px_rgba(112,78,8,0.08)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-headline text-2xl font-extrabold text-[#51370a]">Daily Trophy Case</p>
                <p className="mt-1 max-w-xl text-sm font-semibold text-[#75633d]">
                  Complete all seven daily games on one puzzle date to earn a trophy.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#7d5108]">
                  {stats.trophies.total} total
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#7d5108]">
                  {stats.trophies.currentMonth} this month
                </span>
              </div>
            </div>

            {stats.trophies.dates.length ? (
              <>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {stats.trophies.dates.map((date) => (
                    <article key={date} className="flex flex-col items-center rounded-[1.5rem] border border-[#ecd99d] bg-white/75 px-3 pb-4 pt-3 text-center">
                      <TrophyIcon />
                      <div className="-mt-1 w-full rounded-lg border border-[#8a5b09] bg-[linear-gradient(180deg,#d99e22,#b97708)] px-2 py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.45)]">
                        <p className="font-headline whitespace-nowrap text-[0.68rem] font-extrabold text-white sm:text-xs">
                          {formatTrophyDate(date)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
                {stats.trophies.bestMonth ? (
                  <p className="mt-4 text-sm font-bold text-[#75633d]">
                    Best month: <span className="text-[#51370a]">{formatTrophyMonth(stats.trophies.bestMonth.month)} · {stats.trophies.bestMonth.count} {stats.trophies.bestMonth.count === 1 ? "trophy" : "trophies"}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#dfc875] bg-white/55 p-6 text-center">
                <div className="mx-auto w-fit opacity-45"><TrophyIcon /></div>
                <p className="font-headline mt-1 text-lg font-extrabold text-[#51370a]">Your first trophy is waiting</p>
                <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-[#75633d]">Finish all seven games on the same day to place it in your case.</p>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)] sm:p-7">
            <div>
              <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Game streaks</p>
              <p className="mt-1 text-sm font-semibold text-[#75777a]">Each game keeps its own daily streak.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {stats.games.map((gameStat) => {
                const game = games.find((item) => item.slug === gameStat.gameSlug);
                if (!game) return null;
                return (
                  <div key={game.slug} className="rounded-[1.4rem] border border-[#edf0f3] p-4 text-center" style={{ backgroundColor: `${game.iconBackground}99` }}>
                    <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/80">
                      <Image src={game.iconSrc} alt={game.iconAlt} width={30} height={30} className="h-8 w-8 object-contain" />
                    </span>
                    <p className="font-headline mt-2 truncate text-sm font-extrabold" style={{ color: gameAccentColors[game.slug] }}>
                      {game.name}
                    </p>
                    <p className="font-headline mt-1 text-2xl font-extrabold text-[#2c2f31]">{gameStat.currentStreak}</p>
                    <p className="text-xs font-bold text-[#75777a]">{gameStat.currentStreak === 1 ? "day" : "days"}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <h2 className="font-headline mt-6 px-6 text-2xl font-extrabold text-[#2c2f31]">Stats</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Daily games played", stats.overall.played.toString()],
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

          {stats.entitlements.advancedStats ? (
            <section className="mt-6 rounded-[2rem] border border-[#d8dce2] bg-[#eff1f4]/75 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-headline text-xl font-extrabold text-[#2c2f31]">
                    <DailyDabbleWordmark plus className="text-[1em]" /> stats unlocked
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#595c5e]">
                    Your account has access to subscriber-only stat areas as they roll out.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </>
  );
}
