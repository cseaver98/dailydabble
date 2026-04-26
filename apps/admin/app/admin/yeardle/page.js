"use client";

import { useEffect, useState } from "react";

const statuses = ["pending_review", "approved", "finished"];
const candidatePageSize = 10;

export default function YeardleAdminTab() {
  const [manualUrl, setManualUrl] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualCandidate, setManualCandidate] = useState(null);
  const [isEditingManualCandidate, setIsEditingManualCandidate] = useState(false);
  const [isLookingUpManualCandidate, setIsLookingUpManualCandidate] = useState(false);
  const [isAddingManualCandidate, setIsAddingManualCandidate] = useState(false);

  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);

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

  const lookupManualCandidate = async () => {
    setIsLookingUpManualCandidate(true);
    setError("");
    setMessage("");
    setManualCandidate(null);

    try {
      const url = String(manualUrl || "").trim();
      if (!url) {
        throw new Error("Paste a Wikipedia URL.");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);
      let response;
      try {
        response = await fetch(`/api/admin/yeardle/title-candidate?url=${encodeURIComponent(url)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to lookup event URL");
      }

      setManualCandidate(payload.candidate || null);
      setManualYear(payload?.candidate?.eventYearGuess ? String(payload.candidate.eventYearGuess) : "");
      setIsEditingManualCandidate(false);
      setMessage("Candidate preview ready.");
    } catch (lookupError) {
      const message =
        lookupError instanceof Error && lookupError.name === "AbortError"
          ? "Lookup timed out. Try again with a direct Wikipedia article URL."
          : lookupError instanceof Error
            ? lookupError.message
            : "Could not lookup event URL.";
      setError(message);
    } finally {
      setIsLookingUpManualCandidate(false);
    }
  };

  const addManualCandidate = async () => {
    if (!manualCandidate) {
      return;
    }

    setIsAddingManualCandidate(true);
    setError("");
    setMessage("");

    try {
      const eventYear = Number(manualYear);
      if (!Number.isFinite(eventYear) || eventYear < 1000 || eventYear > new Date().getFullYear()) {
        throw new Error("Enter a valid event year.");
      }

      const normalizedTitle = String(manualCandidate.title || "").trim();
      const normalizedImageUrl = String(manualCandidate.imageUrl || "").trim();
      const normalizedSummary = String(manualCandidate.hintDescription || "").trim();
      if (!normalizedTitle) {
        throw new Error("Title is required.");
      }
      if (!normalizedImageUrl) {
        throw new Error("Image URL is required.");
      }
      if (!normalizedSummary) {
        throw new Error("Summary is required.");
      }

      const payloadCandidate = {
        ...manualCandidate,
        title: normalizedTitle,
        imageUrl: normalizedImageUrl,
        imageAlt: `${normalizedTitle} historical image`,
        hintDescription: normalizedSummary,
      };

      const response = await fetch("/api/admin/yeardle/title-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: payloadCandidate,
          eventYear,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to add manual candidate");
      }

      setMessage(`Added ${manualCandidate.title} as a pending candidate.`);
      setManualCandidate(null);
      setManualYear("");
      setIsEditingManualCandidate(false);
      await load({ page: currentPage, status: statusFilter });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add manual candidate.");
    } finally {
      setIsAddingManualCandidate(false);
    }
  };

  const rejectManualCandidate = () => {
    setManualCandidate(null);
    setManualYear("");
    setIsEditingManualCandidate(false);
    setMessage("Candidate dismissed.");
  };

  const updateManualCandidateField = (field, value) => {
    setManualCandidate((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [field]: value,
      };
    });
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
      <p className="admin-copy">Review event candidates and keep the approved queue healthy for daily auto-assignment.</p>

      {queueHealth ? (
        <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".7rem .8rem", background: "#f8fafc" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Queue Health</p>
          <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
            Runway: <b>{queueHealth.runwayDays || 0}</b> day(s) | Approved: <b>{queueHealth.approved || 0}</b> |
            Pending: <b>{queueHealth.pending || 0}</b> | Finished: <b>{queueHealth.finished || 0}</b> |
            Total: <b>{queueHealth.total || 0}</b>
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem" }}>
        <p style={{ margin: 0, fontWeight: 900 }}>Add Event by Wikipedia URL</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "end", marginTop: ".55rem" }}>
          <label style={{ fontWeight: 700, fontSize: ".9rem", flex: "1 1 320px" }}>
            Wikipedia URL
            <input
              type="text"
              placeholder="https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              style={{ marginLeft: ".45rem", minWidth: 260 }}
            />
          </label>

          <button
            className="admin-btn primary"
            type="button"
            onClick={() => void lookupManualCandidate()}
            disabled={isLookingUpManualCandidate}
          >
            {isLookingUpManualCandidate ? "Finding..." : "Preview candidate"}
          </button>
        </div>

        {manualCandidate ? (
          <article
            style={{
              marginTop: ".75rem",
              border: "1px solid #d8dce2",
              borderRadius: 12,
              background: "#fff",
              padding: ".65rem",
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              gap: ".6rem",
              alignItems: "start",
            }}
          >
            {manualCandidate.imageUrl ? (
              <img
                src={manualCandidate.imageUrl}
                alt={manualCandidate.imageAlt || manualCandidate.title}
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #d8dce2" }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  border: "1px dashed #c4c9d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6c727a",
                  fontSize: ".72rem",
                  textAlign: "center",
                  padding: ".2rem",
                  background: "#f8fafc",
                }}
              >
                No image yet
              </div>
            )}
            <div>
              {isEditingManualCandidate ? (
                <div style={{ display: "grid", gap: ".35rem" }}>
                  <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                    Title
                    <input
                      type="text"
                      value={manualCandidate.title || ""}
                      onChange={(event) => updateManualCandidateField("title", event.target.value)}
                      style={{ marginLeft: ".35rem", minWidth: 260 }}
                    />
                  </label>
                  <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                    Summary
                    <textarea
                      value={manualCandidate.hintDescription || ""}
                      onChange={(event) => updateManualCandidateField("hintDescription", event.target.value)}
                      rows={4}
                      style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 680 }}
                    />
                  </label>
                  <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                    Image URL
                    <input
                      type="text"
                      value={manualCandidate.imageUrl || ""}
                      onChange={(event) => updateManualCandidateField("imageUrl", event.target.value)}
                      style={{ marginLeft: ".35rem", minWidth: 320 }}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 900 }}>{manualCandidate.title}</p>
                  <p style={{ margin: ".2rem 0", color: "#5b6168", fontSize: ".86rem" }}>
                    {manualCandidate.hintDescription}
                  </p>
                </>
              )}
              <div style={{ marginTop: ".35rem", display: "flex", flexWrap: "wrap", gap: ".4rem", alignItems: "end" }}>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event year
                  <input
                    type="number"
                    min="1000"
                    max={new Date().getFullYear()}
                    value={manualYear}
                    onChange={(event) => setManualYear(event.target.value)}
                    style={{ marginLeft: ".35rem", width: 110 }}
                  />
                </label>
                {manualCandidate.wikipediaUrl ? (
                  <a className="admin-btn" href={manualCandidate.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia</a>
                ) : null}
                <button className="admin-btn" type="button" onClick={() => setIsEditingManualCandidate((value) => !value)} disabled={isAddingManualCandidate}>
                  {isEditingManualCandidate ? "Done editing" : "Edit candidate"}
                </button>
                <button className="admin-btn primary" type="button" onClick={() => void addManualCandidate()} disabled={isAddingManualCandidate}>
                  {isAddingManualCandidate ? "Adding..." : "Add candidate"}
                </button>
                <button className="admin-btn" type="button" onClick={rejectManualCandidate} disabled={isAddingManualCandidate}>
                  Reject
                </button>
              </div>
            </div>
          </article>
        ) : null}
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
