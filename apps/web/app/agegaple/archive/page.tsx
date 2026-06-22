"use client";

import { DailydabbleNav } from "@dailydabble/ui";
import { useEffect, useMemo, useState } from "react";
import AccountNav from "../../components/AccountNav";
import GameMenu from "../../components/GameMenu";
import LockedArchiveTile from "../../components/LockedArchiveTile";
import useArchiveCompletionStatus from "../../components/useArchiveCompletionStatus";

import type { ArchivePuzzleListItem } from "@/lib/agegaple/types";
import LoadingLabel from "../../components/LoadingLabel";

type ArchiveResponse = {
  items?: ArchivePuzzleListItem[];
  lockEnabled?: boolean;
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
  const [lockEnabled, setLockEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const completedDates = useArchiveCompletionStatus("agegaple", items.map((item) => item.puzzleDate));

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
        setLockEnabled(Boolean(payload.lockEnabled));
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

    return items.map((item) => {
      const archiveGameNumber = sequenceByDate.get(item.puzzleDate) ?? 1;
      return {
        ...item,
        archiveGameNumber,
        isLocked: lockEnabled && archiveGameNumber === 1,
        isCompleted: completedDates.has(item.puzzleDate),
        dateLabel: formatDateLabel(item.puzzleDate),
        hideDate: lockEnabled && archiveGameNumber === 1,
        tileLabel: lockEnabled && archiveGameNumber === 1 ? "?" : `#${lockEnabled ? archiveGameNumber - 1 : archiveGameNumber}`,
      };
    });
  }, [completedDates, items, lockEnabled]);
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
        leftContent={
          <GameMenu todayHref="/agegaple" archiveHref="/agegaple/archive" />
        }
        rightContent={<AccountNav />}
      />

      <div className="container">
        <section className="card legal-card archive-card">
          <h1 className="page-title">Archive Games</h1>

          {loading ? <p className="page-subtle"><LoadingLabel text="Loading archive" /></p> : null}
          {!loading && error ? <p className="page-subtle error-text">{error}</p> : null}

          {!loading && !error ? (
            <div className="archive-grid">
              {rows.length === 0 ? <p className="page-subtle archive-empty-copy">No archived Agegaple games yet.</p> : null}
              {pagedRows.map((item) => (
                <LockedArchiveTile
                  key={item.puzzleDate}
                  href={`/agegaple/archive/${item.puzzleDate}`}
                  tileLabel={item.tileLabel}
                  dateLabel={item.dateLabel}
                  isLocked={item.isLocked}
                  isCompleted={item.isCompleted}
                  hideDate={item.hideDate}
                />
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
