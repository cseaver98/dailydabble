"use client";

import { useEffect, useMemo, useState } from "react";

const sportOptions = [
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "soccer", label: "Soccer" },
  { value: "nhl", label: "NHL" },
];

const batchSizeOptions = [1, 3, 5, 7, 10, 14];
const today = () => new Date().toISOString().slice(0, 10);

const parseAliases = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SportleAdminTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);

  const [athletes, setAthletes] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today());

  const [newSport, setNewSport] = useState("nba");
  const [newFullName, setNewFullName] = useState("");
  const [seedSport, setSeedSport] = useState("nba");
  const [seedBatchSize, setSeedBatchSize] = useState(5);
  const [seedStartDate, setSeedStartDate] = useState(today());

  const [form, setForm] = useState({
    sport: "nba",
    fullName: "",
    aliases: "",
    teamName: "",
    teamLogoUrl: "",
    yearsWithTeam: "",
    position: "",
    keyStat1: "",
    keyStat2: "",
    finalClue: "",
    wikipediaUrl: "",
    headshotUrl: "",
    isActive: true,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sportle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Sportle admin data");
      }

      const nextAthletes = Array.isArray(payload.athletes) ? payload.athletes : [];
      const nextSchedule = Array.isArray(payload.schedule) ? payload.schedule : [];
      setAthletes(nextAthletes);
      setSchedule(nextSchedule);

      const nextSelected = selectedAthleteId || nextAthletes[0]?.id || "";
      setSelectedAthleteId(nextSelected);

      const selected = nextAthletes.find((item) => item.id === nextSelected);
      if (selected) {
        setForm({
          sport: selected.sport || "nba",
          fullName: selected.full_name || "",
          aliases: Array.isArray(selected.aliases) ? selected.aliases.join(", ") : "",
          teamName: selected.team_name || "",
          teamLogoUrl: selected.team_logo_url || "",
          yearsWithTeam: selected.years_with_team || "",
          position: selected.position || "",
          keyStat1: selected.key_stat_1 || "",
          keyStat2: selected.key_stat_2 || "",
          finalClue: selected.final_clue || "",
          wikipediaUrl: selected.wikipedia_url || "",
          headshotUrl: selected.headshot_url || "",
          isActive: selected.is_active !== false,
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Sportle admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const selected = athletes.find((item) => item.id === selectedAthleteId);
    if (!selected) {
      return;
    }
    setForm({
      sport: selected.sport || "nba",
      fullName: selected.full_name || "",
      aliases: Array.isArray(selected.aliases) ? selected.aliases.join(", ") : "",
      teamName: selected.team_name || "",
      teamLogoUrl: selected.team_logo_url || "",
      yearsWithTeam: selected.years_with_team || "",
      position: selected.position || "",
      keyStat1: selected.key_stat_1 || "",
      keyStat2: selected.key_stat_2 || "",
      finalClue: selected.final_clue || "",
      wikipediaUrl: selected.wikipedia_url || "",
      headshotUrl: selected.headshot_url || "",
      isActive: selected.is_active !== false,
    });
  }, [athletes, selectedAthleteId]);

  const schedulePreview = useMemo(
    () => [...schedule].sort((a, b) => String(b.puzzle_date).localeCompare(String(a.puzzle_date))).slice(0, 24),
    [schedule],
  );

  const addAthlete = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sportle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-athlete",
          sport: newSport,
          fullName: newFullName,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not add athlete");
      }
      setNewFullName("");
      setMessage("Athlete added.");
      await load();
      if (payload?.item?.id) {
        setSelectedAthleteId(payload.item.id);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add athlete");
    } finally {
      setBusy(false);
    }
  };

  const assignDate = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sportle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-date",
          athleteId: selectedAthleteId,
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

  const saveAthlete = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sportle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          sport: form.sport,
          fullName: form.fullName,
          aliases: parseAliases(form.aliases),
          teamName: form.teamName,
          teamLogoUrl: form.teamLogoUrl,
          yearsWithTeam: form.yearsWithTeam,
          position: form.position,
          keyStat1: form.keyStat1,
          keyStat2: form.keyStat2,
          finalClue: form.finalClue,
          wikipediaUrl: form.wikipediaUrl,
          headshotUrl: form.headshotUrl,
          isActive: form.isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not save athlete");
      }
      setMessage("Athlete updated.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save athlete");
    } finally {
      setBusy(false);
    }
  };

  const runSeed = async () => {
    setSeedBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sportle/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: seedSport,
          batchSize: seedBatchSize,
          startDate: seedStartDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Seed failed");
      }
      const summary = payload?.summary;
      setMessage(
        summary
          ? `Seeded ${summary.insertedCount} candidates, scheduled ${summary.scheduledCount}.`
          : payload.output || "Seed completed.",
      );
      await load();
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not run seed.");
    } finally {
      setSeedBusy(false);
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Sportle Curation</h1>
      <p className="admin-copy">
        Manage athlete clues and daily scheduling. Seed starts from Wikipedia category pages, then you can refine clues manually.
      </p>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Wikipedia seed</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={seedSport}
            onChange={(event) => setSeedSport(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          >
            {sportOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={seedBatchSize}
            onChange={(event) => setSeedBatchSize(Number(event.target.value))}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          >
            {batchSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            type="date"
            value={seedStartDate}
            onChange={(event) => setSeedStartDate(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn primary" type="button" onClick={() => void runSeed()} disabled={seedBusy}>
            {seedBusy ? "Seeding..." : "Seed from Wikipedia"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Add athlete candidate</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={newSport}
            onChange={(event) => setNewSport(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          >
            {sportOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            value={newFullName}
            onChange={(event) => setNewFullName(event.target.value)}
            placeholder="Athlete name"
            style={{ minWidth: 220, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn primary" type="button" onClick={() => void addAthlete()} disabled={busy}>
            Add Athlete
          </button>
        </div>
      </div>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Edit athlete clues</p>
        <div style={{ display: "grid", gap: ".55rem", marginTop: ".55rem" }}>
          <select
            value={selectedAthleteId}
            onChange={(event) => setSelectedAthleteId(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          >
            <option value="">Choose athlete</option>
            {athletes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name} ({String(item.sport || "").toUpperCase()})
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gap: ".5rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Sport
              <select
                value={form.sport}
                onChange={(event) => setForm((prev) => ({ ...prev, sport: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              >
                {sportOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Full name
              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Aliases (comma-separated)
              <input
                value={form.aliases}
                onChange={(event) => setForm((prev) => ({ ...prev, aliases: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Team name
              <input
                value={form.teamName}
                onChange={(event) => setForm((prev) => ({ ...prev, teamName: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Team logo URL
              <input
                value={form.teamLogoUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, teamLogoUrl: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Years with team
              <input
                value={form.yearsWithTeam}
                onChange={(event) => setForm((prev) => ({ ...prev, yearsWithTeam: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Position
              <input
                value={form.position}
                onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Key stat #1
              <input
                value={form.keyStat1}
                onChange={(event) => setForm((prev) => ({ ...prev, keyStat1: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Key stat #2 / accolade
              <input
                value={form.keyStat2}
                onChange={(event) => setForm((prev) => ({ ...prev, keyStat2: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Final clue
              <input
                value={form.finalClue}
                onChange={(event) => setForm((prev) => ({ ...prev, finalClue: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Wikipedia URL
              <input
                value={form.wikipediaUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, wikipediaUrl: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: ".86rem" }}>
              Headshot URL
              <input
                value={form.headshotUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, headshotUrl: event.target.value }))}
                style={{ width: "100%", marginTop: ".2rem", padding: ".52rem .66rem", borderRadius: 10, border: "1px solid #d8dce2" }}
              />
            </label>
          </div>

          <label style={{ fontWeight: 700, fontSize: ".86rem", display: "inline-flex", alignItems: "center", gap: ".5rem" }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active for autocomplete and gameplay
          </label>

          <button className="admin-btn primary" type="button" onClick={() => void saveAthlete()} disabled={busy || !selectedAthleteId}>
            Save Athlete
          </button>
        </div>
      </div>

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Assign to date</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn" type="button" onClick={() => void assignDate()} disabled={busy || !selectedAthleteId}>
            Assign Date
          </button>
        </div>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Sportle data...</p> : null}
      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d" }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d" }}>{message}</p> : null}

      <div style={{ marginTop: ".95rem", borderTop: "1px solid #e4e8ee", paddingTop: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Recent schedule</p>
        {schedulePreview.length === 0 ? (
          <p className="admin-copy" style={{ marginTop: ".45rem" }}>No scheduled Sportle dates yet.</p>
        ) : (
          <ul style={{ marginTop: ".45rem", paddingLeft: "1.1rem", color: "#4d5662" }}>
            {schedulePreview.map((row) => {
              const athlete = athletes.find((item) => item.id === row.athlete_id);
              return (
                <li key={`${row.puzzle_date}-${row.athlete_id}`} style={{ marginBottom: ".2rem" }}>
                  {row.puzzle_date}: {athlete?.full_name || row.athlete_id}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
