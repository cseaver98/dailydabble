"use client";

import Link from "next/link";
import { DailydabbleMenu, DailydabbleNav } from "@dailydabble/ui";
import { useEffect, useMemo, useState } from "react";

import type { ArchivePuzzleListItem } from "@/lib/agegaple/types";

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
const archivePageSize = 30;

export default function ArchivePage() {
  const [items, setItems] = useState<ArchivePuzzleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/agegaple/puzzle/archive", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as ArchiveResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load archive");
        }

        if (!active) {
          return;
        }

        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load archive";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
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

  return (
    <div className="agegaple-shell">
    <main className="min-h-screen text-[color:var(--foreground)]">
      <DailydabbleNav
        subtitle="Agegaple"
        subtitleHref="/agegaple"
        homeHref="/"
        rightContent={
          <DailydabbleMenu
            items={[
              { label: "DailyDabble", href: "/", brand: true },
              { label: "Today", href: "/agegaple" },
              { label: "Archive games", href: "/agegaple/archive" },
            ]}
          />
        }
      />

      <div className="container">
        <section className="card legal-card archive-card">
          <h1 className="page-title">Archive Games</h1>

          {loading ? <p className="page-subtle">Loading archive...</p> : null}
          {!loading && error ? <p className="page-subtle error-text">{error}</p> : null}

          {!loading && !error ? (
            <div className="archive-grid">
              {rows.length === 0 ? <p className="page-subtle">No archived Agegaple games yet.</p> : null}
              {pagedRows.map((item) => (
                <Link key={item.puzzleDate} className="archive-tile" href={`/agegaple/archive/${item.puzzleDate}`}>
                  <span className="archive-tile-title">{item.tileLabel}</span>
                  <span className="archive-tile-date">{item.dateLabel}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {!loading && !error && rows.length > archivePageSize ? (
            <div className="archive-pagination">
              <button
                className="admin-btn-like"
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <p className="page-subtle">Page <b>{currentPage}</b> of <b>{totalPages}</b></p>
              <button
                className="admin-btn-like"
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
    </div>
  );
}
