"use client";

import Link from "next/link";
import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { useEffect, useMemo, useState } from "react";

import type { ArchivePuzzleListItem } from "@/lib/types";

type ArchiveResponse = {
  items?: ArchivePuzzleListItem[];
  error?: string;
};

const formatDateLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export default function ArchivePage() {
  const [items, setItems] = useState<ArchivePuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isDarkMode = false;

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/puzzle/archive", { cache: "no-store" });
        const payload = (await response.json()) as ArchiveResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load archive");
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load archive";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        dateLabel: formatDateLabel(item.puzzleDate),
      })),
    [items],
  );
  const mainClass = "min-h-screen text-[color:var(--foreground)]";
  const mutedTextClass = "text-[color:var(--outline)]";

  return (
    <main className={`${mainClass} flex flex-col`}>
      <DailydabbleNav
        subtitle="Agegaple"
        subtitleHref="/"
        label="Archive games"
        homeHref="https://dailydabble.app"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "DailyDabble", href: "https://dailydabble.app", brand: true },
              { label: "Archive games", href: "/archive" },
              { label: "Today", href: "/" },
            ]}
          />
        }
      />

      <div className="container flex flex-1 min-h-0 flex-col gap-5">
        {loading && <p className={mutedTextClass}>Loading archive...</p>}
        {error && (
          <p
            className={`rounded-md border p-3 ${
              isDarkMode
                ? "border-rose-400/50 bg-rose-950/40 text-rose-200"
                : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-3">
            {rows.length === 0 && (
              <p
                className={`rounded-md border p-3 ${
                  isDarkMode ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] text-[color:var(--outline)]"
                }`}
              >
                No archived games yet.
              </p>
            )}
            {rows.map((item) => (
              <Link
                key={item.puzzleDate}
                href={`/archive/${item.puzzleDate}`}
                className={`flex items-center justify-between rounded-full border px-5 py-4 font-semibold ${
                  isDarkMode
                    ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                    : "border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] hover:bg-[color:var(--surface-container-high)]"
                }`}
              >
                <span>{item.couple}</span>
                <span className={`text-sm ${isDarkMode ? "text-zinc-400" : "text-[color:var(--outline)]"}`}>{item.dateLabel}</span>
              </Link>
            ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
