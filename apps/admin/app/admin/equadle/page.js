"use client";

import { useEffect, useMemo, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

export default function EquadleAdminTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [puzzles, setPuzzles] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [newEquation, setNewEquation] = useState("");
  const [selectedPuzzleId, setSelectedPuzzleId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/equadle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Equadle admin data");
      }

      const nextPuzzles = Array.isArray(payload.puzzles) ? payload.puzzles : [];
      setPuzzles(nextPuzzles);
      setSchedule(Array.isArray(payload.schedule) ? payload.schedule : []);
      if (!selectedPuzzleId && nextPuzzles[0]?.id) {
        setSelectedPuzzleId(nextPuzzles[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Equadle admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulePreview = useMemo(
    () => [...schedule].sort((a, b) => String(b.puzzle_date).localeCompare(String(a.puzzle_date))).slice(0, 20),
    [schedule],
  );

  const addPuzzle = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/equadle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-puzzle",
          equation: newEquation,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not add puzzle");
      }
      setNewEquation("");
      setMessage("Puzzle added.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add puzzle");
    } finally {
      setBusy(false);
    }
  };

  const assignDate = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/equadle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-date",
          puzzleId: selectedPuzzleId,
          puzzleDate: selectedDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not assign date");
      }
      setMessage(`Assigned puzzle to ${selectedDate}.`);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not assign date");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Equadle Curation</h1>
      <p className="admin-copy">Add valid 9-character equations and assign them to daily dates.</p>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Add puzzle candidate</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap" }}>
          <input
            value={newEquation}
            onChange={(event) => setNewEquation(event.target.value)}
            placeholder="3*10-4=26"
            style={{ minWidth: 220, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn primary" type="button" onClick={() => void addPuzzle()} disabled={busy}>
            Add Equation
          </button>
        </div>
      </div>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Assign to date</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={selectedPuzzleId}
            onChange={(event) => setSelectedPuzzleId(event.target.value)}
            style={{ minWidth: 260, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          >
            <option value="">Choose puzzle</option>
            {puzzles.map((item) => (
              <option key={item.id} value={item.id}>{item.equation}</option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn" type="button" onClick={() => void assignDate()} disabled={busy || !selectedPuzzleId}>
            Assign Date
          </button>
        </div>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Equadle data...</p> : null}
      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d" }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d" }}>{message}</p> : null}

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Recent schedule</p>
        {schedulePreview.length === 0 ? (
          <p className="admin-copy" style={{ marginTop: ".45rem" }}>No scheduled Equadle dates yet.</p>
        ) : (
          <ul style={{ marginTop: ".45rem", paddingLeft: "1.1rem", color: "#4d5662" }}>
            {schedulePreview.map((row) => {
              const puzzle = puzzles.find((item) => item.id === row.puzzle_id);
              return (
                <li key={`${row.puzzle_date}-${row.puzzle_id}`} style={{ marginBottom: ".2rem" }}>
                  {row.puzzle_date}: {puzzle?.equation || row.puzzle_id}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
