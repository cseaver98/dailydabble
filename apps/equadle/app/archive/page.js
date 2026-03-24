"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MainNav from "../components/MainNav";

const formatDateLabel = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export default function ArchivePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/puzzle/archive", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load archive");
        }

        if (!active) {
          return;
        }

        setItems(Array.isArray(payload.items) ? payload.items : []);
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

  const rows = useMemo(
    () => items.map((item) => ({ ...item, dateLabel: formatDateLabel(item.puzzleDate) })),
    [items],
  );

  return (
    <>
      <MainNav label="Archive games" />
      <main className="container">
        <section className="card legal-card archive-card">
          <h1 className="page-title">Archive Games</h1>

          {loading ? <p className="page-subtle">Loading archive...</p> : null}
          {!loading && error ? <p className="page-subtle error-text">{error}</p> : null}

          {!loading && !error ? (
            <div className="archive-list">
              {rows.length === 0 ? <p className="page-subtle">No archived Equadle games yet.</p> : null}
              {rows.map((item) => (
                <Link key={item.puzzleDate} className="archive-link" href={`/archive/${item.puzzleDate}`}>
                  <span>Equadle puzzle</span>
                  <span>{item.dateLabel}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
