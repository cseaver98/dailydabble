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
    : parsed.toLocaleDateString("en-US", { year: "2-digit", month: "numeric", day: "numeric" });
};
const archivePageSize = 30;

export default function ArchivePage() {
  const [items, setItems] = useState<ArchivePuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  const rows = useMemo(() => {
    const sequenceByDate = new Map(
      [...items]
        .sort((left, right) => left.puzzleDate.localeCompare(right.puzzleDate))
        .map((item, index) => [item.puzzleDate, index + 1]),
    );

    return items.map((item) => ({
      ...item,
      dateLabel: formatDateLabel(item.puzzleDate),
      tileLabel: `#${sequenceByDate.get(item.puzzleDate) ?? 1}`,
    }));
  }, [items]);
  const totalPages = Math.max(1, Math.ceil(rows.length / archivePageSize));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * archivePageSize;
    return rows.slice(start, start + archivePageSize);
  }, [currentPage, rows]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  const mainClass = "min-h-screen text-[color:var(--foreground)]";
  const mutedTextClass = "text-[color:var(--outline)]";

  return (
    <main className={`${mainClass} flex flex-col`}>
      <DailydabbleNav
        subtitle="Agegaple"
        subtitleHref="/"
        homeHref="https://dailydabble.app"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "DailyDabble", href: "https://dailydabble.app", brand: true },
              { label: "Today", href: "/" },
              { label: "Archive games", href: "/archive" },
            ]}
          />
        }
      />

      <div className="container flex flex-1 min-h-0 flex-col gap-5">
        <section className="card grid gap-[0.8rem] border border-[color:var(--surface-container)]">
          <h1 className="m-0 mb-1 font-headline text-[1.4rem] font-bold">Archive Games</h1>
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
            <div className="grid justify-start gap-[0.55rem] [grid-template-columns:repeat(auto-fill,minmax(88px,88px))]">
              {rows.length === 0 ? (
                <p className={mutedTextClass}>No archived games yet.</p>
              ) : null}
              {pagedRows.map((item) => (
                <Link
                  key={item.puzzleDate}
                  href={`/archive/${item.puzzleDate}`}
                  className="grid aspect-square place-content-center justify-items-center gap-[0.5rem] rounded-[0.9rem] border border-[color:var(--surface-container)] bg-[color:var(--surface-container-low)] px-[0.45rem] py-[0.45rem] text-center hover:bg-[color:var(--surface-container-high)]"
                >
                  <span className="text-[1.45rem] font-extrabold leading-none">{item.tileLabel}</span>
                  <span className="whitespace-nowrap text-[0.68rem] leading-none text-[#595c5e]">{item.dateLabel}</span>
                </Link>
              ))}
            </div>
          )}
          {!loading && !error && rows.length > archivePageSize ? (
            <div className="mt-[0.35rem] flex items-center justify-between gap-2">
              <button
                className="rounded-full border border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <p className={mutedTextClass}>Page <b>{currentPage}</b> of <b>{totalPages}</b></p>
              <button
                className="rounded-full border border-[color:var(--surface-container)] bg-[color:var(--surface-container-lowest)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
