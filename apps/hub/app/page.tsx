"use client";

import { games } from "@/lib/games";
import { DailydabbleNav } from "@dailydabble/ui";
import { useEffect, useState } from "react";

type StatusResponse = {
  date: string;
  status: Record<string, boolean>;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        await fetch("/api/player", { method: "POST" });
        const res = await fetch("/api/completions/today", { method: "GET" });
        const payload = (await res.json()) as StatusResponse & { error?: string };
        if (!res.ok || payload.error) {
          throw new Error(payload.error ?? "Failed to load status");
        }
        setDate(payload.date);
        setStatus(payload.status);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <>
      <DailydabbleNav
        headerClassName="hub-nav"
        rightContent={
          <a
            href="#"
            className="font-headline rounded-full bg-[#2f672d] px-6 py-2 text-sm font-bold text-[#d1ffc7] transition hover:opacity-90"
          >
            Login
          </a>
        }
      />

      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-6xl">
        <div className="mb-12 py-10 text-center sm:py-12">
          <p className="mx-auto max-w-2xl text-base text-[#595c5e] sm:text-lg">
            Your daily check-in across all games.
          </p>
          {date && <p className="mt-3 text-sm text-[#595c5e]">Status date: {date}</p>}
          {error && <p className="mt-3 text-sm text-[#b02500]">{error}</p>}
        </div>

        <div id="games" className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
          {games.map((game, index) => {
            const complete = Boolean(status[game.slug]);
            const isYelple = game.slug === "yelple";
            const iconBackground = isYelple ? "bg-red-100" : "bg-blue-100";
            const iconAccent = isYelple ? "bg-red-700/12" : "bg-[#d87093]/14";
            const buttonBackground = isYelple
              ? "bg-gradient-to-r from-red-600 to-red-800 text-white"
              : "bg-gradient-to-r from-[#d87093] to-[#9e4e6d] text-white";

            return (
              <a
                key={game.slug}
                href={game.href}
                className={`group relative overflow-hidden rounded-[2rem] bg-[#ffffff] p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_44px_rgba(44,47,49,0.1)] ${
                  index === 0 ? "md:-translate-y-2" : ""
                }`}
              >
                <div
                  className={`pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full transition-transform duration-500 group-hover:scale-150 ${iconAccent}`}
                />
                <div className="relative z-10">
                  <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${iconBackground}`}>
                    <span className="font-headline text-[0.65rem] font-extrabold uppercase tracking-[0.22em] text-[#2c2f31]">
                      Logo
                    </span>
                  </div>

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="font-headline text-3xl font-bold text-[#2c2f31]">{game.name}</h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                        complete ? "bg-[#b6f6ab] text-[#114c15]" : "bg-[#fbe276] text-[#4b3f00]"
                      }`}
                    >
                      {loading ? "Loading" : complete ? "Completed" : "Not done"}
                    </span>
                  </div>

                  <p className="mb-8 text-lg text-[#595c5e]">{game.description}</p>
                  <span
                    className={`font-headline inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-4 text-base font-bold transition group-hover:shadow-lg ${buttonBackground}`}
                  >
                    Play
                    <span aria-hidden>▶</span>
                  </span>
                </div>
              </a>
            );
          })}
        </div>

        <section className="glass-nav mx-auto mt-12 max-w-3xl rounded-[2rem] p-8 text-center sm:p-10">
          <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Become a Dabbler</p>
          <p className="mx-auto mt-3 max-w-xl text-[#595c5e]">
            Track streaks, compare times with friends, and unlock account-level progress across every game.
          </p>
          <a
            href="#"
            className="font-headline mt-4 inline-block font-bold text-[#2f672d] underline decoration-2 underline-offset-4 transition hover:opacity-75"
          >
            Create Free Account
          </a>
        </section>
        </section>
      </main>
    </>
  );
}
