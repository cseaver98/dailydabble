"use client";

import { games } from "@/lib/games";
import { DailydabbleNav } from "@dailydabble/ui";
import Image from "next/image";
import Link from "next/link";
import { CSSProperties, useEffect, useState } from "react";
import AccountNav from "./components/AccountNav";
import AuthDialog from "./components/AuthDialog";
import LoadingLabel from "./components/LoadingLabel";
import SiteMenu from "./components/SiteMenu";

type StatusResponse = {
  date: string;
  status: Record<string, boolean>;
  gameStatuses?: Record<string, {
    status: "not_started" | "completed_won" | "completed_lost";
    isWin?: boolean;
    guessesUsed?: number;
    maxGuesses?: number;
    completedAt?: string;
  }>;
};

type AccessResponse = {
  loggedIn: boolean;
  guestCount: number;
  guestLimit: number;
  locked: boolean;
};

type MobileCardMotion = {
  cardTransform: string;
  cardOpacity: number;
  cardShadow: string;
  orbTransform: string;
  orbOpacity: number;
  buttonTransform: string;
  buttonShadow: string;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [gameStatuses, setGameStatuses] = useState<StatusResponse["gameStatuses"]>({});
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [error, setError] = useState("");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileCardMotion, setMobileCardMotion] = useState<Record<string, MobileCardMotion>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const accessRes = await fetch("/api/account/access", { method: "GET" });
        const accessPayload = (await accessRes.json()) as AccessResponse & { error?: string };
        if (!accessRes.ok || accessPayload.error) {
          throw new Error(accessPayload.error ?? "Failed to load account access");
        }

        const statusRes = await fetch("/api/completions/today", { method: "GET" });
        const payload = (await statusRes.json()) as StatusResponse & { error?: string };
        if (!statusRes.ok || payload.error) {
          throw new Error(payload.error ?? "Failed to load status");
        }

        setStatus(payload.status);
        setGameStatuses(payload.gameStatuses ?? {});
        setAccess(accessPayload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const isGuestLocked = Boolean(access?.locked);
  const isLoggedIn = Boolean(access?.loggedIn);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-card]"));
    if (!cards.length) {
      return;
    }

    const updateActiveCard = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileViewport((current) => (current === mobile ? current : mobile));

      if (!mobile) {
        setMobileCardMotion((current) => (Object.keys(current).length ? {} : current));
        return;
      }

      const viewportMidpoint = window.innerHeight / 2;
      const nextMotion = cards.reduce<Record<string, MobileCardMotion>>((acc, card) => {
        const slug = card.getAttribute("data-hub-card");
        if (!slug) {
          return acc;
        }

        const bounds = card.getBoundingClientRect();
        const center = bounds.top + bounds.height / 2;
        const normalizedOffset = (center - viewportMidpoint) / Math.max(window.innerHeight * 0.52, 1);
        const clampedOffset = Math.max(-1, Math.min(1, normalizedOffset));
        const proximity = 1 - Math.abs(clampedOffset);
        const easedProximity = Math.max(0, proximity);
        const translateY = clampedOffset * 22;
        const translateZ = -50 + easedProximity * 50;
        const scale = 0.92 + easedProximity * 0.08;
        const rotateX = clampedOffset * -16;
        const opacity = 0.76 + easedProximity * 0.24;
        const shadowAlpha = 0.05 + easedProximity * 0.09;
        const shadowBlur = 28 + easedProximity * 24;
        const shadowLift = 18 + easedProximity * 18;
        const orbScale = 0.94 + easedProximity * 0.16;
        const orbOpacity = 0.72 + easedProximity * 0.28;
        const buttonScale = 0.975 + easedProximity * 0.025;
        const buttonShadowAlpha = 0.06 + easedProximity * 0.1;
        const buttonShadowBlur = 12 + easedProximity * 14;
        const buttonShadowLift = 10 + easedProximity * 12;

        acc[slug] = {
          cardTransform: `perspective(1200px) translate3d(0, ${translateY.toFixed(2)}px, ${translateZ.toFixed(2)}px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
          cardOpacity: Number(opacity.toFixed(3)),
          cardShadow: `0 ${shadowLift.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(44,47,49,${shadowAlpha.toFixed(3)})`,
          orbTransform: `perspective(1200px) translateZ(${(translateZ * 0.3).toFixed(2)}px) scale(${orbScale.toFixed(3)})`,
          orbOpacity: Number(orbOpacity.toFixed(3)),
          buttonTransform: `perspective(1200px) translateZ(${(translateZ * 0.18).toFixed(2)}px) scale(${buttonScale.toFixed(3)})`,
          buttonShadow: `0 ${buttonShadowLift.toFixed(1)}px ${buttonShadowBlur.toFixed(1)}px rgba(44,47,49,${buttonShadowAlpha.toFixed(3)})`,
        };

        return acc;
      }, {});

      setMobileCardMotion(nextMotion);
    };

    updateActiveCard();
    window.addEventListener("scroll", updateActiveCard, { passive: true });
    window.addEventListener("resize", updateActiveCard);

    return () => {
      window.removeEventListener("scroll", updateActiveCard);
      window.removeEventListener("resize", updateActiveCard);
    };
  }, []);

  return (
    <>
      <DailydabbleNav
        headerClassName="hub-nav"
        leftContent={<SiteMenu />}
        rightContent={<AccountNav />}
      />

      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-6xl">
        <div className="mb-4 py-2 text-center sm:py-3">
          {error && <p className="mt-3 text-sm text-[#b02500]">{error}</p>}
        </div>

        <div id="games" className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2 md:gap-8">
          {games.map((game, index) => {
            const complete = Boolean(status[game.slug]);
            const lockedFromStarting = isGuestLocked && !complete;
            const gameStatus = gameStatuses?.[game.slug]?.status ?? "not_started";
            const statusLabel = loading
              ? "Loading"
              : lockedFromStarting
                ? "Login"
                : gameStatus === "completed_lost"
                  ? "Missed"
                  : complete
                    ? "Completed"
                    : "Not done";
            const isDoodle = game.slug === "doodle";
            const isVerble = game.slug === "verble";
            const isYeardle = game.slug === "yeardle";
            const isEquadle = game.slug === "equadle";
            const isMoviedle = game.slug === "moviedle";
            const isSportle = game.slug === "sportle";
            const motion = mobileCardMotion[game.slug];
            const iconBackground = isDoodle
                ? "bg-sky-100"
                : isVerble
                  ? "bg-[#f3e85c]/20"
                : isYeardle
                  ? "bg-violet-100"
                : isEquadle
                    ? "bg-rose-100"
                  : isMoviedle
                    ? "bg-teal-100"
                    : isSportle
                      ? "bg-amber-100"
                    : "bg-[#d87093]/14";
            const iconAccent = isDoodle
                ? "bg-sky-700/12"
                : isVerble
                  ? "bg-[#e6d900]/22"
                : isYeardle
                  ? "bg-violet-700/12"
                : isEquadle
                    ? "bg-rose-700/12"
                  : isMoviedle
                    ? "bg-teal-700/12"
                    : isSportle
                      ? "bg-amber-700/12"
                    : "bg-[#d87093]/14";
            const buttonBackground = isDoodle
                ? "bg-gradient-to-r from-sky-600 to-blue-800 text-white transition-colors hover:from-sky-700 hover:to-blue-900"
                : isVerble
                  ? "bg-gradient-to-r from-[#e6d900] to-[#cfbf00] text-white transition-colors hover:from-[#d9cb00] hover:to-[#b8a900]"
                : isYeardle
                  ? "bg-gradient-to-r from-violet-600 to-indigo-800 text-white transition-colors hover:from-violet-700 hover:to-indigo-900"
                  : isEquadle
                    ? "bg-gradient-to-r from-[#e03a3e] to-[#ba1a1a] text-white transition-colors hover:from-[#c92f34] hover:to-[#9f1414]"
                  : isMoviedle
                    ? "bg-gradient-to-r from-teal-600 to-emerald-800 text-white transition-colors hover:from-teal-700 hover:to-emerald-900"
                    : isSportle
                      ? "bg-gradient-to-r from-amber-600 to-orange-800 text-white transition-colors hover:from-amber-700 hover:to-orange-900"
                  : "bg-gradient-to-r from-[#d87093] to-[#9e4e6d] text-white transition-colors hover:from-[#c45f81] hover:to-[#8a435f]";
            const cardHoverClass = "hover:-translate-y-1 hover:shadow-[0_24px_44px_rgba(44,47,49,0.1)]";
            const orbHoverClass = "group-hover:scale-150";
            const buttonHoverClass = "group-hover:shadow-lg";
            const mobileCardStyle: CSSProperties | undefined = isMobileViewport && motion
              ? {
                  transform: motion.cardTransform,
                  opacity: motion.cardOpacity,
                  boxShadow: motion.cardShadow,
                }
              : undefined;
            const mobileOrbStyle: CSSProperties | undefined = isMobileViewport && motion
              ? {
                  transform: motion.orbTransform,
                  opacity: motion.orbOpacity,
                }
              : undefined;
            const mobileButtonStyle: CSSProperties | undefined = isMobileViewport && motion
              ? {
                  transform: motion.buttonTransform,
                  boxShadow: motion.buttonShadow,
                }
              : undefined;

            return (
              <a
                key={game.slug}
                href={game.href}
                onClick={(event) => {
                  if (!lockedFromStarting) return;
                  event.preventDefault();
                  setIsAuthOpen(true);
                }}
                data-hub-card={game.slug}
                style={mobileCardStyle}
                className={`group relative overflow-hidden rounded-[2rem] bg-[#ffffff] p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] transition-all duration-300 ease-out max-md:transform-gpu max-md:will-change-transform max-md:duration-[420ms] max-md:ease-[cubic-bezier(0.22,0.61,0.36,1)] ${cardHoverClass} ${
                  index === 0 ? "md:-translate-y-2" : ""
                }`}
              >
                <div
                  style={mobileOrbStyle}
                  className={`pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] max-md:transform-gpu max-md:will-change-transform max-md:duration-[120ms] max-md:ease-out ${orbHoverClass} ${iconAccent}`}
                />
                <div className="relative z-10">
                  <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${iconBackground}`}>
                    {isDoodle ? (
                      <Image
                        src="/doodle-mark-v2.png"
                        alt="Doodle logo"
                        width={42}
                        height={42}
                        className="h-10 w-10 object-contain"
                      />
                    ) : isVerble ? (
                      <Image
                        src="/verble-mark-v3.png"
                        alt="Verble logo"
                        width={42}
                        height={42}
                        className="h-10 w-10 object-contain"
                      />
                    ) : isYeardle ? (
                      <Image
                        src="/yeardle-mark-v2.png"
                        alt="Yeardle logo"
                        width={42}
                        height={42}
                        className="h-10 w-10 object-contain"
                      />
                    ) : isEquadle ? (
                      <Image
                        src="/equadle-mark-v2.png"
                        alt="Equadle logo"
                        width={46}
                        height={46}
                        className="h-11 w-11 object-contain"
                      />
                    ) : isMoviedle ? (
                      <Image
                        src="/moviedle-mark-v2.png"
                        alt="Moviedle logo"
                        width={52}
                        height={52}
                        className="h-[3.15rem] w-[3.15rem] object-contain"
                      />
                    ) : isSportle ? (
                      <Image
                        src="/sportle-mark-v2.png"
                        alt="Sportle logo"
                        width={54}
                        height={54}
                        className="h-[3.35rem] w-[3.35rem] object-contain"
                      />
                    ) : (
                      <Image
                        src="/agegaple-mark-v3.png"
                        alt="Agegaple falcon logo"
                        width={40}
                        height={40}
                        className="h-9.5 w-9.5 object-contain"
                      />
                    )}
                  </div>

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="font-headline text-3xl font-bold text-[#2c2f31]">{game.name}</h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wider ${
                        loading ? "normal-case" : "uppercase"
                      } ${
                        loading
                          ? "bg-[#eff1f4] text-[#595c5e]"
                          : complete
                          ? "bg-[#d1ffc7] text-[#114c15]"
                          : lockedFromStarting
                            ? "bg-[#eff1f4] text-[#595c5e]"
                            : "bg-[#fff2a6] text-[#4b3f00]"
                      }`}
                    >
                      <span>{loading ? <LoadingLabel text={statusLabel} /> : statusLabel}</span>
                      {complete ? (
                        <span
                          aria-hidden
                          className="inline-block h-2 w-3.5 -translate-y-0.5 rotate-[-45deg] border-b-[0.16rem] border-l-[0.16rem] border-[#114c15]"
                        />
                      ) : null}
                    </span>
                  </div>

                  <p className="mb-8 text-lg text-[#595c5e]">{game.description}</p>
                  <span
                    style={mobileButtonStyle}
                    className={`font-headline inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-4 text-base font-bold transition-all duration-300 ease-out max-md:transform-gpu max-md:will-change-transform max-md:duration-[420ms] max-md:ease-[cubic-bezier(0.22,0.61,0.36,1)] ${buttonHoverClass} ${
                      lockedFromStarting ? "bg-[#2c2f31] text-white hover:bg-[#111315]" : buttonBackground
                    }`}
                  >
                    {lockedFromStarting ? "Sign in to play" : "Play"}
                    <span
                      aria-hidden
                      className="inline-block h-0 w-0 border-y-[0.38rem] border-l-[0.62rem] border-y-transparent border-l-current"
                    />
                  </span>
                </div>
              </a>
            );
          })}

        </div>
        <section className="glass-nav mx-auto mt-12 max-w-3xl rounded-[2rem] p-8 text-center sm:p-10">
          <p className="font-headline inline-flex items-center justify-center gap-2 text-2xl font-extrabold text-[#2c2f31]">
            <span>{loading ? <LoadingLabel text="Loading" /> : isLoggedIn ? "Check Your Stats" : "Become a Dabbler"}</span>
            {isLoggedIn && !loading ? (
              <svg
                aria-hidden="true"
                className="h-6 w-6 text-[#2c2f31]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M4 20V4"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path
                  d="M4 20H20"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <rect x="7" y="12" width="3" height="5.5" rx="1" fill="currentColor" />
                <rect x="11" y="8" width="3" height="9.5" rx="1" fill="currentColor" />
                <rect x="15" y="5" width="3" height="12.5" rx="1" fill="currentColor" />
              </svg>
            ) : null}
          </p>
          {!loading ? (
            <>
              <p className="mx-auto mt-3 max-w-xl text-[#595c5e]">
                {isLoggedIn
                  ? "See your win rates, streaks, guesses, and progress across every DailyDabble game."
                  : "Track streaks, compare times with friends, and unlock account-level progress across every game."}
              </p>
              {isLoggedIn ? (
                <Link
                  href="/account/stats"
                  className="font-headline mt-4 inline-block font-bold text-[#2f672d] underline decoration-2 underline-offset-4 transition hover:opacity-75"
                >
                  View Stats
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="font-headline mt-4 inline-block font-bold text-[#2f672d] underline decoration-2 underline-offset-4 transition hover:opacity-75"
                >
                  Create Free Account
                </button>
              )}
            </>
          ) : null}
        </section>
        <section className="mx-auto mt-6 max-w-3xl text-center">
          <p className="text-sm text-[#595c5e]">
            <a href="/terms" className="font-semibold text-[#2c2f31] underline underline-offset-2 hover:opacity-75">Terms</a>
            {" "}
            and
            {" "}
            <a href="/privacy" className="font-semibold text-[#2c2f31] underline underline-offset-2 hover:opacity-75">Privacy</a>
          </p>
        </section>
        </section>
      </main>
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} mode={isGuestLocked ? "gate" : "login"} />
    </>
  );
}
