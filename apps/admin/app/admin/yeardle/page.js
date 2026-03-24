"use client";

import { useMemo, useState } from "react";

const batchSizeOptions = [1, 3, 5, 7, 10, 14];

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

export default function YeardleAdminTab() {
  const [batchSize, setBatchSize] = useState(5);
  const [startDate, setStartDate] = useState(todayDateInputValue());
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [seedOutput, setSeedOutput] = useState("");
  const [seedResult, setSeedResult] = useState(null);

  const summaryLine = useMemo(() => {
    if (!seedResult) {
      return "";
    }
    return `Scheduled ${seedResult.scheduledCount} day(s), skipped ${seedResult.skippedCount}.`;
  }, [seedResult]);

  const runSeed = async () => {
    setIsSeeding(true);
    setSeedError("");
    setSeedOutput("");
    setSeedResult(null);

    try {
      const response = await fetch("/api/admin/yeardle/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize, startDate }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Yeardle seed failed");
      }

      setSeedOutput(payload.output || "Seed finished.");
      setSeedResult(payload.summary || null);
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Could not seed Yeardle content.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Yeardle Curation</h1>
      <p className="admin-copy">
        Seed daily Yeardle events from Wikipedia On This Day data. Each entry includes image, year, and hint ladder.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "end", marginTop: "1rem" }}>
        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Batch size
          <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} style={{ marginLeft: ".45rem" }}>
            {batchSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            style={{ marginLeft: ".45rem" }}
          />
        </label>

        <button className="admin-btn primary" type="button" onClick={() => void runSeed()} disabled={isSeeding}>
          {isSeeding ? "Seeding..." : `Seed ${batchSize} Day(s)`}
        </button>
      </div>

      {seedError ? <p className="admin-copy" style={{ color: "#8b2d2d", marginTop: ".75rem" }}>{seedError}</p> : null}
      {seedOutput ? <p className="admin-copy" style={{ color: "#2f672d", marginTop: ".75rem" }}>{seedOutput}</p> : null}
      {summaryLine ? <p className="admin-copy" style={{ marginTop: ".45rem" }}>{summaryLine}</p> : null}

      {seedResult?.items?.length ? (
        <div style={{ marginTop: ".8rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Recent assignments</p>
          <ul style={{ marginTop: ".45rem", paddingLeft: "1.2rem", color: "#4d5662" }}>
            {seedResult.items.map((item) => (
              <li key={`${item.date}-${item.eventId}`} style={{ marginBottom: ".3rem" }}>
                {item.date}: {item.title} ({item.eventYear})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
