"use client";

import { useEffect, useMemo, useState } from "react";
import QueueHealthPanel from "../components/queue-health-panel";

const candidateStatuses = ["pending", "approved", "finished"];
const filterStatuses = ["pending", "approved", "today", "finished", "all"];
const candidatePageSize = 10;
const PLACEHOLDER_IMAGE = "/favicon.svg";
const statusLabel = {
  pending: "pending",
  approved: "approved",
  today: "today",
  finished: "finished",
  all: "all",
};

export default function MoviedleAdminTab() {
  const [titleQuery, setTitleQuery] = useState("");
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [titleLibraryCount, setTitleLibraryCount] = useState(0);
  const [titleLookupError, setTitleLookupError] = useState("");
  const [createStatus, setCreateStatus] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreatingCandidate, setIsCreatingCandidate] = useState(false);

  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
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

  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [editingCandidateDraft, setEditingCandidateDraft] = useState(null);
  const [savingCandidateId, setSavingCandidateId] = useState(null);

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

  useEffect(() => {
    let isCancelled = false;
    const loadTitleLibraryCount = async () => {
      try {
        const response = await fetch("/api/admin/moviedle/titles?limit=1", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load title library count");
        }
        if (!isCancelled) {
          setTitleLibraryCount(Number(payload.totalTitles) || 0);
        }
      } catch {
        if (!isCancelled) {
          setTitleLibraryCount(0);
        }
      }
    };

    void loadTitleLibraryCount();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = titleQuery.trim();
    setTitleLookupError("");
    setCreateError("");
    setCreateStatus("");

    if (!trimmed || trimmed.length < 2) {
      setTitleSuggestions([]);
      return;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/moviedle/titles?q=${encodeURIComponent(trimmed)}&limit=8`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to search title library");
        }
        if (!isCancelled) {
          setTitleSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
          setTitleLibraryCount(Number(payload.totalTitles) || 0);
        }
      } catch (lookupError) {
        if (!isCancelled) {
          setTitleSuggestions([]);
          setTitleLookupError(lookupError instanceof Error ? lookupError.message : "Could not search title library.");
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [titleQuery]);

  const createCandidateFromTitle = async () => {
    const trimmed = titleQuery.trim();
    if (!trimmed) {
      setCreateError("Choose a movie title first.");
      return;
    }

    setCreateError("");
    setCreateStatus("");
    setIsCreatingCandidate(true);
    try {
      const response = await fetch("/api/admin/moviedle/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId: selectedTitle?.id || null,
          title: trimmed,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create candidate from title");
      }

      setCreateStatus(
        payload.action === "updated"
          ? `Updated candidate for "${payload.title || trimmed}".`
          : `Created candidate for "${payload.title || trimmed}".`,
      );
      setTitleSuggestions([]);
      await load({ page: 1, status: statusFilter });
    } catch (createCandidateError) {
      setCreateError(createCandidateError instanceof Error ? createCandidateError.message : "Could not create candidate.");
    } finally {
      setIsCreatingCandidate(false);
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

  const beginEditCandidate = (item) => {
    setEditingCandidateId(item.id);
    setEditingCandidateDraft({
      title: String(item.title || ""),
      releaseYear: item.release_year ? String(item.release_year) : "",
      director: String(item.director || ""),
      leadActors: Array.isArray(item.lead_actors) ? item.lead_actors.join(", ") : "",
      summary: String(item.summary || ""),
      reviewNotes: String(item.review_notes || ""),
    });
  };

  const cancelEditCandidate = () => {
    setEditingCandidateId(null);
    setEditingCandidateDraft(null);
  };

  const updateEditingCandidateField = (field, value) => {
    setEditingCandidateDraft((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
  };

  const saveCandidateDetails = async (candidateId) => {
    if (!editingCandidateDraft) {
      return;
    }

    setSavingCandidateId(candidateId);
    setError("");
    try {
      const response = await fetch(`/api/admin/moviedle/candidates/${encodeURIComponent(candidateId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingCandidateDraft.title,
          releaseYear: editingCandidateDraft.releaseYear,
          director: editingCandidateDraft.director,
          summary: editingCandidateDraft.summary,
          reviewNotes: editingCandidateDraft.reviewNotes,
          leadActors: editingCandidateDraft.leadActors
            .split(",")
            .map((actor) => actor.trim())
            .filter(Boolean),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update movie candidate");
      }

      cancelEditCandidate();
      await load({ page: currentPage, status: statusFilter });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update movie candidate.");
    } finally {
      setSavingCandidateId(null);
    }
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

  return (
    <>
      <section className="admin-card">
        <h1 className="admin-title">Moviedle Curation</h1>
        <p className="admin-copy">Create candidates from the title library, curate still images, and move candidates through review.</p>

        <QueueHealthPanel queueHealth={queueHealth} />

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
          <p style={{ margin: 0, fontWeight: 900 }}>Create candidate from title library (OMDb enrichment)</p>
          <p className="admin-copy" style={{ margin: 0 }}>
            Library size: <b>{titleLibraryCount}</b> titles.
          </p>

          <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem", position: "relative" }}>
            Search title
            <input
              type="text"
              value={titleQuery}
              onChange={(event) => {
                setTitleQuery(event.target.value);
                setSelectedTitle(null);
              }}
              placeholder="Start typing a movie title..."
              autoComplete="off"
              style={{ borderRadius: 12, border: "1px solid #cfd4da", padding: ".55rem .85rem" }}
            />
          </label>

          {titleSuggestions.length > 0 ? (
            <div style={{ display: "grid", gap: ".35rem", marginTop: "-.2rem" }}>
              {titleSuggestions.map((item) => (
                <button
                  key={item.id}
                  className="admin-btn"
                  type="button"
                  onClick={() => {
                    setSelectedTitle(item);
                    setTitleQuery(item.title);
                    setTitleSuggestions([]);
                  }}
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".65rem", alignItems: "center" }}>
            <button className="admin-btn primary" type="button" onClick={() => void createCandidateFromTitle()} disabled={isCreatingCandidate}>
              {isCreatingCandidate ? "Creating..." : "Create Candidate"}
            </button>
            {selectedTitle ? <p className="admin-copy" style={{ margin: 0 }}>Selected: <b>{selectedTitle.title}</b></p> : null}
          </div>

          {createStatus ? <p className="admin-copy" style={{ color: "#2f672d", margin: 0 }}>{createStatus}</p> : null}
          {createError ? <p className="admin-copy" style={{ color: "#8b2d2d", margin: 0 }}>{createError}</p> : null}
          {titleLookupError ? <p className="admin-copy" style={{ color: "#8b2d2d", margin: 0 }}>{titleLookupError}</p> : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", marginTop: ".9rem" }}>
          <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ marginLeft: ".45rem" }}>
              {filterStatuses.map((status) => (
                <option key={status} value={status}>{statusLabel[status] || status}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p style={{ marginTop: ".6rem", color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
        {loading ? <p className="admin-copy">Loading movie candidates...</p> : null}

        <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                border: item.isScheduledToday ? "2px solid #c81e1e" : "1px solid #d8dce2",
                borderRadius: 14,
                background: "#fff",
                padding: ".75rem",
              }}
            >
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
                {item.director ? (
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                    Director: {item.director}
                  </p>
                ) : null}
                {Array.isArray(item.lead_actors) && item.lead_actors.length > 0 ? (
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                    Lead actors: {item.lead_actors.join(", ")}
                  </p>
                ) : null}
                {item.review_notes ? (
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                    Review notes: {item.review_notes}
                  </p>
                ) : null}

                {editingCandidateId === item.id && editingCandidateDraft ? (
                  <div style={{ marginTop: ".5rem", display: "grid", gap: ".45rem", maxWidth: 780 }}>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Title
                      <input
                        type="text"
                        value={editingCandidateDraft.title}
                        onChange={(event) => updateEditingCandidateField("title", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 460, borderRadius: 10, border: "1px solid #cfd4da", padding: ".45rem .6rem" }}
                      />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Release year
                      <input
                        type="number"
                        min="1888"
                        max="2100"
                        value={editingCandidateDraft.releaseYear}
                        onChange={(event) => updateEditingCandidateField("releaseYear", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: 140, borderRadius: 10, border: "1px solid #cfd4da", padding: ".45rem .6rem" }}
                      />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Director
                      <input
                        type="text"
                        value={editingCandidateDraft.director}
                        onChange={(event) => updateEditingCandidateField("director", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 460, borderRadius: 10, border: "1px solid #cfd4da", padding: ".45rem .6rem" }}
                      />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Lead actors (comma-separated)
                      <input
                        type="text"
                        value={editingCandidateDraft.leadActors}
                        onChange={(event) => updateEditingCandidateField("leadActors", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 620, borderRadius: 10, border: "1px solid #cfd4da", padding: ".45rem .6rem" }}
                      />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Summary
                      <textarea
                        rows={4}
                        value={editingCandidateDraft.summary}
                        onChange={(event) => updateEditingCandidateField("summary", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 720, borderRadius: 10, border: "1px solid #cfd4da", padding: ".5rem .6rem" }}
                      />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Review notes
                      <textarea
                        rows={3}
                        value={editingCandidateDraft.reviewNotes}
                        onChange={(event) => updateEditingCandidateField("reviewNotes", event.target.value)}
                        style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 720, borderRadius: 10, border: "1px solid #cfd4da", padding: ".5rem .6rem" }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                      <button
                        className="admin-btn primary"
                        type="button"
                        onClick={() => void saveCandidateDetails(item.id)}
                        disabled={savingCandidateId === item.id}
                      >
                        {savingCandidateId === item.id ? "Saving..." : "Save candidate"}
                      </button>
                      <button className="admin-btn" type="button" onClick={cancelEditCandidate}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: ".35rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                  <button className="admin-btn" type="button" onClick={() => openGallery(item.id)}>Manage stills</button>
                  <button className="admin-btn" type="button" onClick={() => beginEditCandidate(item)}>
                    Edit candidate
                  </button>
                  {candidateStatuses.map((status) => (
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
                      {statusLabel[status] || status}
                    </button>
                  ))}
                  <button className="admin-btn" type="button" onClick={() => void deleteCandidate(item.id)}>
                    Delete
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
