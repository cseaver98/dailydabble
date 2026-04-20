"use client";

import { useEffect, useMemo, useState } from "react";

const statuses = ["pending_review", "approved", "finished"];
const candidatePageSize = 10;
const PLACEHOLDER_IMAGE = "/favicon.svg";

export default function MoviedleAdminTab() {
  const [titlesText, setTitlesText] = useState("");
  const [minVotes, setMinVotes] = useState(1000);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);

  const [galleryCandidateId, setGalleryCandidateId] = useState(null);
  const [galleryByCandidateId, setGalleryByCandidateId] = useState({});
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [newStillUrl, setNewStillUrl] = useState("");
  const [isAddingStill, setIsAddingStill] = useState(false);
  const [isRemovingStill, setIsRemovingStill] = useState(false);

  const [scheduleById, setScheduleById] = useState({});
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const load = async ({ page = currentPage, status = statusFilter } = {}) => {
    try {
      setError("");
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(candidatePageSize),
      });
      const response = await fetch(`/api/admin/moviedle/candidates?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load movie candidates");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueHealth(payload.queueHealth || null);
      setTotalCandidates(Number(payload.total) || 0);
      setCurrentPage(Number(payload.page) || page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load movie candidates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    void load({ page: 1, status: statusFilter });
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCandidates, 0) / candidatePageSize));
  const galleryCandidate = useMemo(
    () => items.find((item) => item.id === galleryCandidateId) ?? null,
    [items, galleryCandidateId],
  );
  const galleryUrls = galleryCandidateId ? (galleryByCandidateId[galleryCandidateId] || []) : [];
  const activeGalleryUrl = galleryUrls[galleryIndex] || galleryUrls[0] || null;

  useEffect(() => {
    if (!galleryUrls.length) {
      setGalleryIndex(0);
      return;
    }
    if (galleryIndex >= galleryUrls.length) {
      setGalleryIndex(galleryUrls.length - 1);
    }
  }, [galleryUrls.length, galleryIndex]);

  const runTitleImport = async () => {
    setImportError("");
    setImportStatus("");

    const lines = titlesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setImportError("Paste at least one movie title (one per line).");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/admin/moviedle/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titlesText,
          minVotes,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to import title list");
      }

      setImportStatus(`Imported title list. Inserted ${payload.inserted || 0}, updated ${payload.updated || 0}, skipped ${payload.skipped || 0}.`);
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        setImportError(payload.errors.slice(0, 5).join("\n"));
      }
      await load({ page: 1, status: statusFilter });
    } catch (runError) {
      setImportError(runError instanceof Error ? runError.message : "Could not import titles.");
    } finally {
      setImporting(false);
    }
  };

  const patchStatus = async (id, status) => {
    if (status === "finished") {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/moviedle/candidates", {
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

  const deleteCandidate = async (id) => {
    const shouldDelete = window.confirm("Delete this movie candidate and its stored data?");
    if (!shouldDelete) {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/moviedle/candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Failed to delete movie candidate");
      return;
    }
    await load({ page: currentPage, status: statusFilter });
  };

  const loadGallery = async (candidateId) => {
    if (!candidateId) {
      return;
    }

    setGalleryError("");
    setIsGalleryLoading(true);
    try {
      const response = await fetch(`/api/admin/moviedle/stills?candidateId=${encodeURIComponent(candidateId)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load stills");
      }
      setGalleryByCandidateId((current) => ({
        ...current,
        [candidateId]: Array.isArray(payload.stillUrls) ? payload.stillUrls : [],
      }));
    } catch (loadError) {
      setGalleryError(loadError instanceof Error ? loadError.message : "Could not load stills.");
      setGalleryByCandidateId((current) => ({
        ...current,
        [candidateId]: [],
      }));
    } finally {
      setIsGalleryLoading(false);
    }
  };

  const openGallery = (candidateId) => {
    setGalleryCandidateId(candidateId);
    setGalleryIndex(0);
    setNewStillUrl("");
    setGalleryError("");
    void loadGallery(candidateId);
  };

  const closeGallery = () => {
    setGalleryCandidateId(null);
    setGalleryIndex(0);
    setNewStillUrl("");
    setGalleryError("");
  };

  const addStillUrl = async (candidateId, urlToAdd) => {
    if (!candidateId || !urlToAdd) {
      return;
    }
    setIsAddingStill(true);
    setGalleryError("");
    try {
      const response = await fetch("/api/admin/moviedle/stills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, action: "add", url: urlToAdd }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed adding still image");
      }
      setGalleryByCandidateId((current) => ({
        ...current,
        [candidateId]: Array.isArray(payload.stillUrls) ? payload.stillUrls : [],
      }));
      setNewStillUrl("");
      await load({ page: currentPage, status: statusFilter });
    } catch (addError) {
      setGalleryError(addError instanceof Error ? addError.message : "Could not add still image.");
    } finally {
      setIsAddingStill(false);
    }
  };

  const removeStillUrl = async (candidateId, urlToRemove) => {
    if (!candidateId || !urlToRemove) {
      return;
    }
    setIsRemovingStill(true);
    setGalleryError("");
    try {
      const response = await fetch("/api/admin/moviedle/stills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, action: "remove", url: urlToRemove }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed removing still image");
      }
      setGalleryByCandidateId((current) => ({
        ...current,
        [candidateId]: Array.isArray(payload.stillUrls) ? payload.stillUrls : [],
      }));
      await load({ page: currentPage, status: statusFilter });
    } catch (removeError) {
      setGalleryError(removeError instanceof Error ? removeError.message : "Could not remove still image.");
    } finally {
      setIsRemovingStill(false);
    }
  };

  const uploadStillFiles = async (candidateId, files) => {
    if (!candidateId || !files?.length) {
      return;
    }

    setIsAddingStill(true);
    setGalleryError("");
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);

        const uploadResponse = await fetch("/api/admin/moviedle/upload-still", {
          method: "POST",
          body,
        });
        const uploadPayload = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadPayload.url) {
          throw new Error(uploadPayload.error || `Failed to upload ${file.name}`);
        }

        const patchResponse = await fetch("/api/admin/moviedle/stills", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, action: "add", url: uploadPayload.url }),
        });
        const patchPayload = await patchResponse.json().catch(() => ({}));
        if (!patchResponse.ok) {
          throw new Error(patchPayload.error || `Failed to attach uploaded still: ${file.name}`);
        }
        setGalleryByCandidateId((current) => ({
          ...current,
          [candidateId]: Array.isArray(patchPayload.stillUrls) ? patchPayload.stillUrls : [],
        }));
      }

      await load({ page: currentPage, status: statusFilter });
    } catch (uploadError) {
      setGalleryError(uploadError instanceof Error ? uploadError.message : "Could not upload still files.");
    } finally {
      setIsAddingStill(false);
    }
  };

  const scheduleCandidate = async (candidateId) => {
    const puzzleDate = String(scheduleById[candidateId] || "").trim();
    setScheduleError("");
    setScheduleStatus("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
      setScheduleError("Schedule date must be YYYY-MM-DD.");
      return;
    }

    setIsScheduling(true);
    try {
      const response = await fetch("/api/admin/moviedle/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, puzzleDate }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to schedule candidate");
      }
      setScheduleStatus(`Scheduled for ${puzzleDate}.`);
      await load({ page: currentPage, status: statusFilter });
    } catch (scheduleErr) {
      setScheduleError(scheduleErr instanceof Error ? scheduleErr.message : "Could not schedule candidate.");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <>
      <section className="admin-card">
        <h1 className="admin-title">Moviedle Curation</h1>
        <p className="admin-copy">Import movie title lists, curate still images, and move candidates through review.</p>

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

        <div
          style={{
            marginTop: ".9rem",
            border: "1px solid #d8dce2",
            borderRadius: 12,
            background: "#f8fafc",
            padding: ".75rem",
            display: "grid",
            gap: ".6rem",
            maxWidth: 900,
          }}
        >
          <p style={{ margin: 0, fontWeight: 900 }}>Import from title list (OMDb enrichment)</p>
          <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
            Movie titles (one per line)
            <textarea
              value={titlesText}
              onChange={(event) => setTitlesText(event.target.value)}
              rows={8}
              placeholder={"The Matrix\\nInception\\nTrue Grit"}
              style={{ borderRadius: 12, border: "1px solid #cfd4da", padding: ".55rem .85rem", resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".65rem", alignItems: "center" }}>
            <label style={{ display: "grid", gap: ".2rem", fontWeight: 700, fontSize: ".86rem" }}>
              Min IMDb votes
              <input
                type="number"
                min={0}
                max={2000000}
                value={minVotes}
                onChange={(event) => setMinVotes(Number(event.target.value || 0))}
                style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".45rem .75rem", width: 140 }}
              />
            </label>
            <button className="admin-btn primary" type="button" onClick={() => void runTitleImport()} disabled={importing}>
              {importing ? "Importing..." : "Import Title List"}
            </button>
          </div>

          {importStatus ? <p className="admin-copy" style={{ color: "#2f672d", margin: 0 }}>{importStatus}</p> : null}
          {importError ? <pre className="admin-copy" style={{ color: "#8b2d2d", margin: 0, whiteSpace: "pre-wrap" }}>{importError}</pre> : null}
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

        {error ? <p style={{ marginTop: ".6rem", color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
        {scheduleError ? <p style={{ marginTop: ".6rem", color: "#b42318", fontWeight: 700 }}>{scheduleError}</p> : null}
        {scheduleStatus ? <p style={{ marginTop: ".6rem", color: "#2f672d", fontWeight: 700 }}>{scheduleStatus}</p> : null}
        {loading ? <p className="admin-copy">Loading movie candidates...</p> : null}

        <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
          {items.map((item) => (
            <article key={item.id} style={{ border: "1px solid #d8dce2", borderRadius: 14, background: "#fff", padding: ".75rem" }}>
              <div style={{ display: "grid", gap: ".4rem" }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>
                  {item.title} {item.release_year ? `(${item.release_year})` : ""}
                </p>
                <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                  Votes: {Number(item.imdb_votes || 0).toLocaleString()} | Status: {item.status} | Stills: {item.stillCount || 0}
                </p>
                <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                  Schedule: {item.scheduleCount === 0 ? "Not scheduled" : `${item.scheduleCount}x (last ${item.lastScheduledDate})`}
                  {item.isScheduledToday ? " | In use today" : ""}
                </p>
                {item.nextScheduledDate ? (
                  <p style={{ margin: ".15rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                    Scheduled: <b>{item.nextScheduledDate}</b>
                  </p>
                ) : null}
                {item.summary ? (
                  <p style={{ margin: ".2rem 0 0", color: "#353b42", fontSize: ".9rem" }}>{item.summary}</p>
                ) : null}
                {Array.isArray(item.lead_actors) && item.lead_actors.length > 0 ? (
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                    Lead actors: {item.lead_actors.join(", ")}
                  </p>
                ) : null}

                <div style={{ marginTop: ".35rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                  <button className="admin-btn" type="button" onClick={() => openGallery(item.id)}>Manage stills</button>
                  {statuses.map((status) => (
                    <button
                      key={status}
                      className="admin-btn"
                      type="button"
                      onClick={() => void patchStatus(item.id, status)}
                      disabled={status === "finished"}
                      style={{
                        borderColor: (status === "finished" ? item.isFinished : item.status === status) ? "#2f672d" : undefined,
                        background: (status === "finished" ? item.isFinished : item.status === status) ? "#d1ffc7" : undefined,
                        opacity: status === "finished" ? 0.55 : 1,
                      }}
                    >
                      {status}
                    </button>
                  ))}
                  <button className="admin-btn" type="button" onClick={() => void deleteCandidate(item.id)}>
                    Delete
                  </button>
                </div>

                <div style={{ display: "flex", gap: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="date"
                    value={scheduleById[item.id] || ""}
                    onChange={(event) => setScheduleById((current) => ({ ...current, [item.id]: event.target.value }))}
                    style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".42rem .7rem" }}
                  />
                  <button
                    className="admin-btn primary"
                    type="button"
                    onClick={() => void scheduleCandidate(item.id)}
                    disabled={isScheduling || item.status !== "approved"}
                  >
                    Schedule candidate
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!loading && items.length === 0 ? <p className="admin-copy">No movie candidates in this filter yet.</p> : null}
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

      {galleryCandidate ? (
        <div
          onClick={closeGallery}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.65)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(960px, 96vw)",
              maxHeight: "92vh",
              overflow: "auto",
              borderRadius: 16,
              border: "1px solid #d8dce2",
              background: "#fff",
              padding: ".9rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: ".8rem", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900 }}>{galleryCandidate.title}</p>
                <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                  Still {galleryUrls.length ? Math.min(galleryIndex + 1, galleryUrls.length) : 0} of {galleryUrls.length}
                </p>
              </div>
              <button className="admin-btn" type="button" onClick={closeGallery}>Close</button>
            </div>

            <div style={{ marginTop: ".75rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".55rem", background: "#f8fafc" }}>
              {isGalleryLoading ? (
                <p style={{ margin: 0, color: "#5b6168", fontSize: ".9rem" }}>Loading stills...</p>
              ) : (
                <img
                  src={activeGalleryUrl || PLACEHOLDER_IMAGE}
                  alt="Movie still"
                  style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 10, background: "#fff" }}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              )}

              {galleryUrls.length > 1 ? (
                <div style={{ marginTop: ".55rem", display: "flex", gap: ".45rem", justifyContent: "space-between" }}>
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => setGalleryIndex((current) => Math.max(0, current - 1))}
                    disabled={isGalleryLoading || galleryIndex <= 0}
                  >
                    Previous
                  </button>
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => setGalleryIndex((current) => Math.min(galleryUrls.length - 1, current + 1))}
                    disabled={isGalleryLoading || galleryIndex >= galleryUrls.length - 1}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: ".75rem", display: "grid", gap: ".5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: ".55rem", flexWrap: "wrap" }}>
                <button
                  className="admin-btn"
                  type="button"
                  disabled={isGalleryLoading || isRemovingStill || !activeGalleryUrl}
                  onClick={() => void removeStillUrl(galleryCandidate.id, activeGalleryUrl)}
                >
                  {isRemovingStill ? "Removing..." : "Remove active still"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: ".6rem", display: "grid", gap: ".5rem" }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Add still image by URL</p>
                <input
                  value={newStillUrl}
                  onChange={(event) => setNewStillUrl(event.target.value)}
                  placeholder="https://..."
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                />
                <div>
                  <button
                    className="admin-btn primary"
                    type="button"
                    disabled={isAddingStill || !newStillUrl.trim()}
                    onClick={() => void addStillUrl(galleryCandidate.id, newStillUrl.trim())}
                  >
                    {isAddingStill ? "Adding..." : "Add URL"}
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: ".6rem", display: "grid", gap: ".5rem" }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Upload still image file(s)</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    if (selected.length > 0) {
                      void uploadStillFiles(galleryCandidate.id, selected);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {galleryError ? <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{galleryError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
