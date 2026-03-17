"use client";

import { games } from "@/lib/games";
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
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-50 sm:px-8">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Daily game hub</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dailydabble</h1>
          <p className="mt-2 text-slate-300">Your daily check-in across all games.</p>
          {date && <p className="mt-2 text-sm text-slate-400">Status date: {date}</p>}
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((game) => {
            const complete = Boolean(status[game.slug]);
            return (
              <a
                key={game.slug}
                href={game.href}
                className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-400 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-medium">{game.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                      complete ? "bg-emerald-300 text-emerald-950" : "bg-amber-200 text-amber-950"
                    }`}
                  >
                    {loading ? "Loading" : complete ? "Completed" : "Not done"}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-300">{game.description}</p>
                <p className="mt-5 text-sm font-medium text-cyan-300 group-hover:text-cyan-200">
                  Open game
                </p>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
