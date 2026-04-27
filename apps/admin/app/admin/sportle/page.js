"use client";

import { useEffect, useState } from "react";

const sportOptions = [
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "soccer", label: "Soccer" },
  { value: "nhl", label: "NHL" },
];

const batchSizeOptions = [1, 3, 5, 7, 10, 14];
const statuses = ["pending_review", "approved", "finished"];
const filterStatuses = ["pending_review", "approved", "today", "finished"];
const candidatePageSize = 10;

const parseAliases = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SportleAdminTab() {
  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);

  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);

  const [newSport, setNewSport] = useState("nba");
  const [newFullName, setNewFullName] = useState("");
  const [seedSport, setSeedSport] = useState("nba");
  const [seedBatchSize, setSeedBatchSize] = useState(5);

  const [detailsAthleteId, setDetailsAthleteId] = useState(null);
  const [detailsForm, setDetailsForm] = useState(null);

  const load = async ({ page = currentPage, status = statusFilter } = {}) => {
    try {
      setError("");
      const search = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(candidatePageSize),
      });
      const response = await fetch(`/api/admin/sportle?${search.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Sportle candidates");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueHealth(payload.queueHealth || null);
      setTotalCandidates(Number(payload.total) || 0);
      setCurrentPage(Number(payload.page) || page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Sportle candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void load({ page: 1, status: statusFilter });
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCandidates, 0) / candidatePageSize));

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
      setMessage("Athlete added as pending review.");
      await load({ page: 1, status: statusFilter });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add athlete");
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
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Seed failed");
      }
      const summary = payload?.summary;
      setMessage(summary ? `Seeded ${summary.insertedCount} candidates.` : "Seed completed.");
      await load({ page: 1, status: statusFilter });
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not run seed.");
    } finally {
      setSeedBusy(false);
    }
  };

  const patchStatus = async (id, status) => {
    if (status === "finished") {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/sportle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: id, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Failed to update status");
      return;
    }
    await load({ page: currentPage, status: statusFilter });
  };

  const deleteCandidate = async (id) => {
    const shouldDelete = window.confirm("Delete this Sportle candidate and its stored data?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    const response = await fetch("/api/admin/sportle", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not delete candidate");
      return;
    }

    await load({ page: currentPage, status: statusFilter });
  };

  const openDetails = (item) => {
    setDetailsAthleteId(item.id);
    setDetailsForm({
      sport: item.sport || "nba",
      fullName: item.full_name || "",
      aliases: Array.isArray(item.aliases) ? item.aliases.join(", ") : "",
      teamName: item.team_name || "",
      yearsWithTeam: item.years_with_team || "",
      position: item.position || "",
      keyStat1: item.key_stat_1 || "",
      keyStat2: item.key_stat_2 || "",
      finalClue: item.final_clue || "",
      wikipediaUrl: item.wikipedia_url || "",
      headshotUrl: item.headshot_url || "",
      isActive: item.is_active !== false,
    });
  };

  const saveDetails = async () => {
    if (!detailsAthleteId || !detailsForm) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sportle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: detailsAthleteId,
          sport: detailsForm.sport,
          fullName: detailsForm.fullName,
          aliases: parseAliases(detailsForm.aliases),
          teamName: detailsForm.teamName,
          yearsWithTeam: detailsForm.yearsWithTeam,
          position: detailsForm.position,
          keyStat1: detailsForm.keyStat1,
          keyStat2: detailsForm.keyStat2,
          finalClue: detailsForm.finalClue,
          wikipediaUrl: detailsForm.wikipediaUrl,
          headshotUrl: detailsForm.headshotUrl,
          isActive: detailsForm.isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not save athlete details");
      }
      setDetailsAthleteId(null);
      setDetailsForm(null);
      await load({ page: currentPage, status: statusFilter });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save athlete details");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Sportle Curation</h1>
      <p className="admin-copy">Review athlete candidates and approve them for the daily runway queue.</p>

      {queueHealth ? (
        <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".7rem .8rem", background: "#f8fafc" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Queue Health</p>
          <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
            Runway: <b>{queueHealth.runwayDays || 0}</b> day(s) | Approved: <b>{queueHealth.approved || 0}</b> |
            Approved unused: <b>{queueHealth.approvedUnused || 0}</b> | Pending: <b>{queueHealth.pending || 0}</b> |
            Finished: <b>{queueHealth.finished || 0}</b> | Total: <b>{queueHealth.total || 0}</b>
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem", display: "grid", gap: ".7rem" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 900 }}>Wikipedia seed</p>
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
            <select value={seedSport} onChange={(event) => setSeedSport(event.target.value)} style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}>
              {sportOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select value={seedBatchSize} onChange={(event) => setSeedBatchSize(Number(event.target.value))} style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}>
              {batchSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button className="admin-btn primary" type="button" onClick={() => void runSeed()} disabled={seedBusy}>
              {seedBusy ? "Seeding..." : "Seed from Wikipedia"}
            </button>
          </div>
        </div>

        <div>
          <p style={{ margin: 0, fontWeight: 900 }}>Add athlete candidate</p>
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
            <select value={newSport} onChange={(event) => setNewSport(event.target.value)} style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}>
              {sportOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={newFullName} onChange={(event) => setNewFullName(event.target.value)} placeholder="Athlete name" style={{ minWidth: 220, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }} />
            <button className="admin-btn primary" type="button" onClick={() => void addAthlete()} disabled={busy}>Add Athlete</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", marginTop: ".9rem" }}>
        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ marginLeft: ".45rem" }}>
            <option value="all">all</option>
            {filterStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Sportle candidates...</p> : null}
      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d" }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d" }}>{message}</p> : null}

      <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
        {items.map((item) => (
          <article
            key={item.id}
            style={{
              border: item.isScheduledToday ? "2px solid #d24a43" : "1px solid #d8dce2",
              borderRadius: 14,
              background: "#fff",
              padding: ".75rem",
            }}
          >
            <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>{item.full_name}</p>
            <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
              Sport: {String(item.sport || "").toUpperCase()} | Status: {item.status} | Position: {item.position || "unknown"}
            </p>
            <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
              Usage: {item.scheduleCount === 0 ? "Not used yet" : `${item.scheduleCount}x (last ${item.lastScheduledDate})`}
            </p>
            {item.nextScheduledDate ? (
              <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                Scheduled: <b>{item.nextScheduledDate}</b>
              </p>
            ) : null}

            <div style={{ marginTop: ".45rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
              <button className="admin-btn" type="button" onClick={() => openDetails(item)}>Edit details</button>
              {statuses.map((status) => {
                const isSelected = status === "finished" ? item.isFinished : item.status === status;
                return (
                  <button
                    key={status}
                    className="admin-btn"
                    type="button"
                    onClick={() => void patchStatus(item.id, status)}
                    disabled={status === "finished"}
                    style={{
                      borderColor: isSelected ? "#2f672d" : undefined,
                      background: isSelected ? "#d1ffc7" : undefined,
                      opacity: status === "finished" ? 0.55 : 1,
                    }}
                  >
                    {status}
                  </button>
                );
              })}
              <button className="admin-btn" type="button" onClick={() => void deleteCandidate(item.id)}>Delete</button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-copy">No Sportle candidates in this filter yet.</p> : null}
      </div>

      {!loading && totalCandidates > 0 ? (
        <div style={{ marginTop: ".9rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
          <p className="admin-copy" style={{ margin: 0 }}>
            Showing page <b>{currentPage}</b> of <b>{Math.max(1, Math.ceil(totalCandidates / candidatePageSize))}</b> ({totalCandidates} candidates)
          </p>
          <div style={{ display: "flex", gap: ".45rem" }}>
            <button className="admin-btn" type="button" onClick={() => void load({ page: Math.max(1, currentPage - 1), status: statusFilter })} disabled={currentPage <= 1}>Previous</button>
            <button className="admin-btn" type="button" onClick={() => void load({ page: Math.min(totalPages, currentPage + 1), status: statusFilter })} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </div>
      ) : null}

      {detailsAthleteId && detailsForm ? (
        <div onClick={() => { setDetailsAthleteId(null); setDetailsForm(null); }} style={{ position: "fixed", inset: 0, zIndex: 125, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", padding: "1rem" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(900px, 96vw)", maxHeight: "92vh", overflow: "auto", borderRadius: 16, border: "1px solid #d8dce2", background: "#fff", padding: ".9rem" }}>
            <div style={{ display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Sport
                <select value={detailsForm.sport} onChange={(event) => setDetailsForm((current) => ({ ...current, sport: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}>
                  {sportOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Full name
                <input value={detailsForm.fullName} onChange={(event) => setDetailsForm((current) => ({ ...current, fullName: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
            </div>

            <div style={{ marginTop: ".55rem", display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Aliases (comma-separated)
                <input value={detailsForm.aliases} onChange={(event) => setDetailsForm((current) => ({ ...current, aliases: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Team name
                <input value={detailsForm.teamName} onChange={(event) => setDetailsForm((current) => ({ ...current, teamName: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
            </div>

            <div style={{ marginTop: ".55rem", display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Position
                <input value={detailsForm.position} onChange={(event) => setDetailsForm((current) => ({ ...current, position: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Years with team
                <input value={detailsForm.yearsWithTeam} onChange={(event) => setDetailsForm((current) => ({ ...current, yearsWithTeam: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
            </div>

            <div style={{ marginTop: ".55rem", display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Key stat #1
                <textarea rows={2} value={detailsForm.keyStat1} onChange={(event) => setDetailsForm((current) => ({ ...current, keyStat1: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Key stat #2
                <textarea rows={2} value={detailsForm.keyStat2} onChange={(event) => setDetailsForm((current) => ({ ...current, keyStat2: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
            </div>

            <label style={{ marginTop: ".55rem", display: "grid", gap: ".28rem", fontWeight: 700 }}>
              Final clue
              <textarea rows={2} value={detailsForm.finalClue} onChange={(event) => setDetailsForm((current) => ({ ...current, finalClue: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
            </label>

            <div style={{ marginTop: ".55rem", display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Wikipedia URL
                <input value={detailsForm.wikipediaUrl} onChange={(event) => setDetailsForm((current) => ({ ...current, wikipediaUrl: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Headshot URL
                <input value={detailsForm.headshotUrl} onChange={(event) => setDetailsForm((current) => ({ ...current, headshotUrl: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
              </label>
            </div>

            <label style={{ marginTop: ".55rem", fontWeight: 700, fontSize: ".86rem", display: "inline-flex", alignItems: "center", gap: ".5rem" }}>
              <input type="checkbox" checked={detailsForm.isActive} onChange={(event) => setDetailsForm((current) => ({ ...current, isActive: event.target.checked }))} />
              Active for gameplay
            </label>

            <div style={{ marginTop: ".8rem", display: "flex", justifyContent: "flex-end", gap: ".45rem" }}>
              <button className="admin-btn" type="button" onClick={() => { setDetailsAthleteId(null); setDetailsForm(null); }}>Cancel</button>
              <button className="admin-btn primary" type="button" onClick={() => void saveDetails()} disabled={busy}>Save details</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
