"use client";

import { useEffect, useState } from "react";
import QueueHealthPanel from "../components/queue-health-panel";

const statuses = ["pending_review", "approved", "finished"];
const filterStatuses = ["pending_review", "approved", "today", "finished", "all"];
const candidatePageSize = 10;
const statusLabel = (status) => (status === "pending_review" ? "pending" : status);

export default function EquadleAdminTab() {
  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);

  const [newEquation, setNewEquation] = useState("");

  const load = async ({ page = currentPage, status = statusFilter } = {}) => {
    try {
      setError("");
      const search = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(candidatePageSize),
      });
      const response = await fetch(`/api/admin/equadle?${search.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Equadle candidates");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueHealth(payload.queueHealth || null);
      setTotalCandidates(Number(payload.total) || 0);
      setCurrentPage(Number(payload.page) || page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Equadle candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void load({ page: 1, status: statusFilter });
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCandidates, 0) / candidatePageSize));

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
        if (payload.duplicateWarning) {
          window.alert(payload.duplicateWarning);
          return;
        }
        throw new Error(payload.error || "Could not add puzzle");
      }
      setNewEquation("");
      setMessage("Puzzle added as pending review.");
      await load({ page: 1, status: statusFilter });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add puzzle");
    } finally {
      setBusy(false);
    }
  };

  const generateRandomPuzzle = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/equadle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-random",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not generate puzzle");
      }
      const created = payload?.item?.equation;
      setMessage(created ? `Generated puzzle: ${created}` : "Generated puzzle added as pending review.");
      await load({ page: 1, status: statusFilter });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not generate puzzle");
    } finally {
      setBusy(false);
    }
  };

  const patchStatus = async (id, status, confirmDuplicate = false) => {
    if (status === "finished") {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/equadle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: id, status, confirmDuplicate }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (payload.duplicateWarning) {
        if (window.confirm(`${payload.duplicateWarning}\n\nApprove anyway?`)) {
          await patchStatus(id, status, true);
        }
        return;
      }
      setError(payload.error || "Failed to update status");
      return;
    }
    if (payload.warning && !confirmDuplicate) {
      window.alert(payload.warning);
    }
    await load({ page: currentPage, status: statusFilter });
  };

  const deleteCandidate = async (id) => {
    const shouldDelete = window.confirm("Delete this Equadle candidate and its stored data?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    const response = await fetch("/api/admin/equadle", {
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
      <h1 className="admin-title">Equadle Curation</h1>
      <p className="admin-copy">Review candidate equations and approve them for the daily runway queue.</p>

      <QueueHealthPanel queueHealth={queueHealth} />

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 900 }}>Add puzzle candidate</p>
        <p className="admin-copy" style={{ margin: ".25rem 0 0" }}>Use 9 tiles with a visible two-digit target from 10 to 99.</p>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap" }}>
          <input
            value={newEquation}
            onChange={(event) => setNewEquation(event.target.value)}
            placeholder="12+8*7=68"
            style={{ minWidth: 220, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
          />
          <button className="admin-btn primary" type="button" onClick={() => void addPuzzle()} disabled={busy}>
            Add Equation
          </button>
          <button className="admin-btn" type="button" onClick={() => void generateRandomPuzzle()} disabled={busy}>
            Generate Random Equation
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", marginTop: ".9rem" }}>
        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ marginLeft: ".45rem" }}>
            {filterStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Equadle candidates...</p> : null}
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
            <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>{item.equation}</p>
            <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
              Length: {item.equation_length} | Status: {item.status}
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
          </article>
        ))}
        {!loading && items.length === 0 ? <p className="admin-copy">No Equadle candidates in this filter yet.</p> : null}
      </div>

      {!loading && totalCandidates > 0 ? (
        <div style={{ marginTop: ".9rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
          <p className="admin-copy" style={{ margin: 0 }}>
            Showing page <b>{currentPage}</b> of <b>{totalPages}</b> ({totalCandidates} candidates)
          </p>
          <div style={{ display: "flex", gap: ".45rem" }}>
            <button
              className="admin-btn"
              type="button"
              onClick={() => void load({ page: Math.max(1, currentPage - 1), status: statusFilter })}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <button
              className="admin-btn"
              type="button"
              onClick={() => void load({ page: Math.min(totalPages, currentPage + 1), status: statusFilter })}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
