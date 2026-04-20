"use client";

import { useEffect, useState } from "react";

const batchSizeOptions = [1, 3, 5, 7, 10, 14];
const statuses = ["pending_review", "approved", "finished"];
const candidatePageSize = 10;
const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

export default function YeardleAdminTab() {
  const [batchSize, setBatchSize] = useState(5);
  const [startDate, setStartDate] = useState(todayDateInputValue());
  const [isSeeding, setIsSeeding] = useState(false);

  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [scheduleById, setScheduleById] = useState({});

  const load = async ({ page = currentPage, status = statusFilter } = {}) => {
    try {
      setError("");
      const search = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(candidatePageSize),
      });
      const response = await fetch(`/api/admin/yeardle?${search.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Yeardle candidates");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueHealth(payload.queueHealth || null);
      setTotalCandidates(Number(payload.total) || 0);
      setCurrentPage(Number(payload.page) || page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Yeardle candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void load({ page: 1, status: statusFilter });
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCandidates, 0) / candidatePageSize));

  const runSeed = async () => {
    setIsSeeding(true);
    setError("");
    setMessage("");

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

      const summary = payload?.summary;
      setMessage(summary ? `Scheduled ${summary.scheduledCount} day(s), skipped ${summary.skippedCount}.` : "Seed finished.");
      await load({ page: 1, status: statusFilter });
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not seed Yeardle content.");
    } finally {
      setIsSeeding(false);
    }
  };

  const patchStatus = async (id, status) => {
    if (status === "finished") {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/yeardle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Failed to update status");
      return;
    }
    await load({ page: currentPage, status: statusFilter });
  };

  const assignDate = async (id) => {
    const puzzleDate = String(scheduleById[id] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
      setError("Schedule date must be YYYY-MM-DD.");
      return;
    }

    setError("");
    setMessage("");
    const response = await fetch("/api/admin/yeardle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, puzzleDate }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not assign date");
      return;
    }

    setMessage(`Assigned puzzle to ${puzzleDate}.`);
    await load({ page: currentPage, status: statusFilter });
  };

  const deleteCandidate = async (id) => {
    const shouldDelete = window.confirm("Delete this Yeardle candidate and its stored data?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    const response = await fetch("/api/admin/yeardle", {
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

  return (
    <section className="admin-card">
      <h1 className="admin-title">Yeardle Curation</h1>
      <p className="admin-copy">Review event candidates, approve them, and schedule future dates.</p>

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

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 900 }}>Seed from Wikipedia On This Day</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "end", marginTop: ".55rem" }}>
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
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={{ marginLeft: ".45rem" }} />
          </label>

          <button className="admin-btn primary" type="button" onClick={() => void runSeed()} disabled={isSeeding}>
            {isSeeding ? "Seeding..." : `Seed ${batchSize} Day(s)`}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", marginTop: ".9rem" }}>
        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ marginLeft: ".45rem" }}>
            <option value="all">all</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Yeardle candidates...</p> : null}
      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d" }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d" }}>{message}</p> : null}

      <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
        {items.map((item) => (
          <article key={item.id} style={{ border: "1px solid #d8dce2", borderRadius: 14, background: "#fff", padding: ".75rem" }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>{item.title}</p>
            <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
              Year: {item.event_year} | Status: {item.status} | Category: {item.hint_category || "unknown"}
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

            <div style={{ marginTop: ".45rem", display: "flex", gap: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="date"
                value={scheduleById[item.id] || ""}
                onChange={(event) => setScheduleById((current) => ({ ...current, [item.id]: event.target.value }))}
                style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".42rem .7rem" }}
              />
              <button className="admin-btn primary" type="button" onClick={() => void assignDate(item.id)} disabled={item.status !== "approved"}>
                Schedule candidate
              </button>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-copy">No Yeardle candidates in this filter yet.</p> : null}
      </div>

      {!loading && totalCandidates > 0 ? (
        <div style={{ marginTop: ".9rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
          <p className="admin-copy" style={{ margin: 0 }}>
            Showing page <b>{currentPage}</b> of <b>{totalPages}</b> ({totalCandidates} candidates)
          </p>
          <div style={{ display: "flex", gap: ".45rem" }}>
            <button className="admin-btn" type="button" onClick={() => void load({ page: Math.max(1, currentPage - 1), status: statusFilter })} disabled={currentPage <= 1}>Previous</button>
            <button className="admin-btn" type="button" onClick={() => void load({ page: Math.min(totalPages, currentPage + 1), status: statusFilter })} disabled={currentPage >= totalPages}>Next</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
