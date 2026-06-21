"use client";

import { useEffect, useMemo, useState } from "react";
import LockedArchiveTile from "../../components/LockedArchiveTile";
import useArchiveCompletionStatus from "../../components/useArchiveCompletionStatus";
import LoadingLabel from "../../components/LoadingLabel";
import MainNav from "../components/MainNav";

const archivePageSize = 30;

type ArchiveItem = { puzzleDate: string };

const formatDateLabel = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export default function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const completedDates = useArchiveCompletionStatus("sportle", items.map((item) => item.puzzleDate));

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/sportle/puzzle/archive", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load archive");
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
        setError(loadError instanceof Error ? loadError.message : "Failed to load archive");
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

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * archivePageSize;
    return rows.slice(start, start + archivePageSize);
  }, [currentPage, rows]);

  return (
    <div className="sportle-shell">
      <MainNav label="" />
      <main className="container">
        <section className="card legal-card archive-card">
          <h1 className="page-title">Archive Games</h1>

          {loading ? <p className="page-subtle"><LoadingLabel text="Loading archive" /></p> : null}
          {!loading && error ? <p className="page-subtle error-text">{error}</p> : null}

          {!loading && !error ? (
            <div className="archive-grid">
              {rows.length === 0 ? <p className="page-subtle archive-empty-copy">No archived Sportle games yet.</p> : null}
              {pagedRows.map((item) => (
                <LockedArchiveTile
                  key={item.puzzleDate}
                  href={`/sportle/archive/${item.puzzleDate}`}
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
              <button className="admin-btn-like" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>Previous</button>
              <p className="page-subtle">Page <b>{currentPage}</b> of <b>{totalPages}</b></p>
              <button className="admin-btn-like" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>Next</button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
