"use client";

import { useEffect, useMemo, useState } from "react";

const statuses = ["pending_review", "approved"];
const filterStatuses = ["pending_review", "approved", "today", "finished"];
const candidatePageSize = 10;
const statusLabel = (status) => String(status || "").replaceAll("_", " ");

export default function VerbleAdminTab() {
  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [manualPhrase, setManualPhrase] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingPhrase, setEditingPhrase] = useState("");
  const [editingSource, setEditingSource] = useState("");

  const load = async ({ page = currentPage, status = statusFilter } = {}) => {
    try {
      setError("");
      const search = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(candidatePageSize),
      });
      const response = await fetch(`/api/admin/verble?${search.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load Verble candidates");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueHealth(payload.queueHealth || null);
      setTotalCandidates(Number(payload.total) || 0);
      setCurrentPage(Number(payload.page) || page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Verble candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void load({ page: 1, status: statusFilter });
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCandidates, 0) / candidatePageSize));

  const createCandidate = async () => {
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/verble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: manualPhrase, sourceNote: manualSource }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create candidate");
      }
      setManualPhrase("");
      setManualSource("");
      setMessage("Added Verble candidate.");
      await load({ page: 1, status: "pending_review" });
      setStatusFilter("pending_review");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create candidate.");
    } finally {
      setCreating(false);
    }
  };

  const patchStatus = async (id, status) => {
    setError("");
    const response = await fetch("/api/admin/verble", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Failed to update status");
      return;
    }
    await load({ page: currentPage, status: statusFilter });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingPhrase(item.phrase || "");
    setEditingSource(item.sourceNote || "");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditingPhrase("");
    setEditingSource("");
  };

  const saveEdit = async (id) => {
    setError("");
    const response = await fetch("/api/admin/verble", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, phrase: editingPhrase, sourceNote: editingSource }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Failed to save candidate");
      return;
    }
    cancelEdit();
    await load({ page: currentPage, status: statusFilter });
  };

  const deleteCandidate = async (id) => {
    const shouldDelete = window.confirm("Delete this Verble candidate?");
    if (!shouldDelete) {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/verble", {
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

  const pageRows = useMemo(() => items, [items]);

  return (
    <section className="admin-card">
      <h1 className="admin-title">Verble Curation</h1>
      <p className="admin-copy">Review phrase candidates and approve them for the daily Verble runway queue.</p>

      {queueHealth ? (
        <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".7rem .8rem", background: "#f8fafc" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Queue Health</p>
          <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
            Pending: <b>{queueHealth.pending || 0}</b> | Approved: <b>{queueHealth.approved || 0}</b> |
            Finished: <b>{queueHealth.finished || 0}</b> | Total: <b>{queueHealth.total || 0}</b>
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem", display: "grid", gap: ".7rem" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 900 }}>Add phrase candidate</p>
          <div style={{ display: "grid", gap: ".55rem", marginTop: ".55rem" }}>
            <input
              type="text"
              value={manualPhrase}
              onChange={(event) => setManualPhrase(event.target.value)}
              placeholder="Actions speak louder than words"
              style={{ width: "100%", padding: ".6rem .75rem", borderRadius: 12, border: "1px solid #d8dce2" }}
            />
            <input
              type="text"
              value={manualSource}
              onChange={(event) => setManualSource(event.target.value)}
              placeholder="Source note (optional)"
              style={{ width: "100%", padding: ".6rem .75rem", borderRadius: 12, border: "1px solid #d8dce2" }}
            />
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <button className="admin-btn primary" type="button" onClick={() => void createCandidate()} disabled={creating}>
                {creating ? "Creating..." : "Create Candidate"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", justifyContent: "space-between", marginTop: ".9rem" }}>
        <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ marginLeft: ".45rem", padding: ".45rem .65rem", borderRadius: 10, border: "1px solid #d8dce2" }}
          >
            {filterStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </label>
        {!loading ? (
          <p className="admin-copy" style={{ margin: 0 }}>
            {totalCandidates} candidate{totalCandidates === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Verble candidates...</p> : null}
      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d" }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d" }}>{message}</p> : null}

      {!loading ? (
        <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
          {pageRows.length === 0 ? <p className="admin-copy">No Verble candidates in this filter yet.</p> : null}
          {pageRows.map((item) => {
            const isEditing = editingId === item.id;
            const isToday = item.status === "approved" && item.isScheduledToday;
            const isFinished = item.status === "finished";

            return (
              <article
                key={item.id}
                style={{
                  border: isToday ? "2px solid #d24a43" : "1px solid #d8dce2",
                  borderRadius: 14,
                  background: "#fff",
                  padding: ".8rem",
                }}
              >
                <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem", lineHeight: 1.35 }}>
                  {isEditing ? "Editing candidate" : item.phrase}
                </p>
                <p style={{ margin: ".22rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                  Status: <b>{isToday ? "today" : statusLabel(item.status)}</b>
                  {item.sourceNote ? <> | Source: {item.sourceNote}</> : null}
                </p>
                {item.nextScheduledDate ? (
                  <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                    Scheduled: <b>{item.nextScheduledDate}</b>
                  </p>
                ) : null}

                {isEditing ? (
                  <div style={{ display: "grid", gap: ".55rem", marginTop: ".65rem" }}>
                    <input
                      value={editingPhrase}
                      onChange={(event) => setEditingPhrase(event.target.value)}
                      placeholder="Phrase"
                      style={{ width: "100%", padding: ".6rem .75rem", borderRadius: 12, border: "1px solid #d8dce2" }}
                    />
                    <input
                      value={editingSource}
                      onChange={(event) => setEditingSource(event.target.value)}
                      placeholder="Source note"
                      style={{ width: "100%", padding: ".6rem .75rem", borderRadius: 12, border: "1px solid #d8dce2" }}
                    />
                  </div>
                ) : null}

                <div style={{ marginTop: ".6rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                  {statuses.map((status) => {
                    const isSelected = item.status === status;
                    return (
                      <button
                        key={status}
                        className="admin-btn"
                        type="button"
                        onClick={() => void patchStatus(item.id, status)}
                        style={{
                          borderColor: isSelected ? "#2f672d" : undefined,
                          background: isSelected ? "#d1ffc7" : undefined,
                        }}
                      >
                        {statusLabel(status)}
                      </button>
                    );
                  })}
                  {isFinished ? (
                    <button className="admin-btn" type="button" disabled style={{ opacity: 0.6 }}>
                      finished
                    </button>
                  ) : null}
                  {!isEditing ? <button className="admin-btn" type="button" onClick={() => startEdit(item)}>Edit</button> : null}
                  {isEditing ? <button className="admin-btn primary" type="button" onClick={() => void saveEdit(item.id)}>Save</button> : null}
                  {isEditing ? <button className="admin-btn" type="button" onClick={cancelEdit}>Cancel</button> : null}
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => void deleteCandidate(item.id)}
                    style={{ borderColor: "#efc7c7", background: "#fff5f5", color: "#8b2d2d" }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && totalCandidates > candidatePageSize ? (
        <div style={{ marginTop: ".9rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
          <p className="admin-copy" style={{ margin: 0 }}>
            Showing page <b>{currentPage}</b> of <b>{totalPages}</b>
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
