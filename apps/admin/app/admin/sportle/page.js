"use client";

import { useEffect, useState } from "react";
import QueueHealthPanel from "../components/queue-health-panel";

const sportOptions = [
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "soccer", label: "Soccer" },
  { value: "nhl", label: "NHL" },
];

const statuses = ["pending_review", "approved", "finished"];
const filterStatuses = ["pending_review", "approved", "today", "finished", "all"];
const candidatePageSize = 10;
const statusLabel = (status) => (status === "pending_review" ? "pending" : status);

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
  const [importBusy, setImportBusy] = useState(false);
  const [uploadBusyField, setUploadBusyField] = useState("");

  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);

  const [newSport, setNewSport] = useState("nba");
  const [newFullName, setNewFullName] = useState("");
  const [importSport, setImportSport] = useState("nba");
  const [importWikipediaUrl, setImportWikipediaUrl] = useState("");

  const [detailsAthleteId, setDetailsAthleteId] = useState(null);
  const [detailsForm, setDetailsForm] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

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

  const importFromWikipedia = async () => {
    setImportBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/sportle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-wikipedia-url",
          sport: importSport,
          wikipediaUrl: importWikipediaUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Import failed");
      }
      setImportWikipediaUrl("");
      setMessage("Imported candidate from Wikipedia.");
      await load({ page: 1, status: statusFilter });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import candidate.");
    } finally {
      setImportBusy(false);
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
      teamLogoUrl: item.team_logo_url || "",
      yearsWithTeam: item.years_with_team || "",
      position: item.position || "",
      keyStat1: item.key_stat_1 || "",
      keyStat2: item.key_stat_2 || "",
      wikipediaUrl: item.wikipedia_url || "",
      headshotUrl: item.headshot_url || "",
      isActive: item.is_active !== false,
    });
  };

  const openPreview = (item) => {
    setPreviewItem(item);
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
          teamLogoUrl: detailsForm.teamLogoUrl,
          yearsWithTeam: detailsForm.yearsWithTeam,
          position: detailsForm.position,
          keyStat1: detailsForm.keyStat1,
          keyStat2: detailsForm.keyStat2,
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

  const uploadImageForField = async (fieldName, file) => {
    if (!file || !detailsForm) {
      return;
    }

    setError("");
    setUploadBusyField(fieldName);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/images/upload", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Could not upload image.");
      }

      setDetailsForm((current) => ({
        ...current,
        [fieldName]: payload.url,
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload image.");
    } finally {
      setUploadBusyField("");
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Sportle Curation</h1>
      <p className="admin-copy">Review athlete candidates and approve them for the daily runway queue.</p>

      <QueueHealthPanel queueHealth={queueHealth} />

      <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".75rem", display: "grid", gap: ".7rem" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 900 }}>Import from Wikipedia URL</p>
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".45rem", flexWrap: "wrap", alignItems: "center" }}>
            <select value={importSport} onChange={(event) => setImportSport(event.target.value)} style={{ padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}>
              {sportOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={importWikipediaUrl}
              onChange={(event) => setImportWikipediaUrl(event.target.value)}
              placeholder="https://en.wikipedia.org/wiki/LeBron_James"
              style={{ minWidth: 360, padding: ".55rem .7rem", borderRadius: 12, border: "1px solid #d8dce2" }}
            />
            <button className="admin-btn primary" type="button" onClick={() => void importFromWikipedia()} disabled={importBusy}>
              {importBusy ? "Importing..." : "Import Athlete"}
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
            {filterStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
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
              <button className="admin-btn" type="button" onClick={() => openPreview(item)}>Preview</button>
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
            <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>Hint Tiles Preview</p>
            <div style={{ marginTop: ".55rem", display: "grid", gap: ".55rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Team Hint</p>
                <input value={detailsForm.teamName} onChange={(event) => setDetailsForm((current) => ({ ...current, teamName: event.target.value }))} placeholder="Team name" style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
                <input value={detailsForm.teamLogoUrl} onChange={(event) => setDetailsForm((current) => ({ ...current, teamLogoUrl: event.target.value }))} placeholder="Team logo URL" style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/avif,image/webp,image/svg+xml,.webp,.svg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void uploadImageForField("teamLogoUrl", file);
                    event.target.value = "";
                  }}
                  disabled={uploadBusyField === "teamLogoUrl"}
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".35rem .5rem", background: "#fff" }}
                />
              </article>

              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Years With Team</p>
                <textarea rows={4} value={detailsForm.yearsWithTeam} onChange={(event) => setDetailsForm((current) => ({ ...current, yearsWithTeam: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
              </article>

              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Position</p>
                <textarea rows={4} value={detailsForm.position} onChange={(event) => setDetailsForm((current) => ({ ...current, position: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
              </article>

              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Key Stat #1</p>
                <textarea rows={4} value={detailsForm.keyStat1} onChange={(event) => setDetailsForm((current) => ({ ...current, keyStat1: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
              </article>

              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Key Stat #2 / Accolade</p>
                <textarea rows={4} value={detailsForm.keyStat2} onChange={(event) => setDetailsForm((current) => ({ ...current, keyStat2: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
              </article>

              <article style={{ border: "1px solid #d8dce2", borderRadius: 12, background: "#f8fafc", padding: ".55rem", minHeight: 170, display: "grid", gap: ".35rem", alignContent: "start" }}>
                <p style={{ margin: 0, fontSize: ".76rem", fontWeight: 800, color: "#8a4a06", textTransform: "uppercase", letterSpacing: ".06em" }}>Headshot Hint</p>
                <input value={detailsForm.headshotUrl} onChange={(event) => setDetailsForm((current) => ({ ...current, headshotUrl: event.target.value }))} placeholder="Headshot URL" style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".45rem .55rem" }} />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/avif,image/webp,image/svg+xml,.webp,.svg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void uploadImageForField("headshotUrl", file);
                    event.target.value = "";
                  }}
                  disabled={uploadBusyField === "headshotUrl"}
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".35rem .5rem", background: "#fff" }}
                />
              </article>
            </div>

            <div style={{ marginTop: ".65rem", display: "grid", gap: ".55rem", gridTemplateColumns: "1fr 1fr" }}>
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
                Wikipedia URL
                <input value={detailsForm.wikipediaUrl} onChange={(event) => setDetailsForm((current) => ({ ...current, wikipediaUrl: event.target.value }))} style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }} />
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

      {previewItem ? (
        <div onClick={() => setPreviewItem(null)} style={{ position: "fixed", inset: 0, zIndex: 126, background: "rgba(0,0,0,0.72)", display: "grid", placeItems: "center", padding: "1rem" }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(840px, 96vw)", maxHeight: "92vh", overflow: "auto", borderRadius: 16, border: "1px solid #d8dce2", background: "#f4f7fb", padding: "1rem" }}>
            <div style={{ background: "#fff", borderRadius: "1.15rem", boxShadow: "0 20px 40px rgba(36, 48, 64, 0.07)", padding: "1rem", display: "grid", gap: ".85rem" }}>
              <div style={{ display: "grid", gap: ".5rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#fff1e0", color: "#a45508", fontWeight: 800, fontSize: ".76rem", textTransform: "uppercase", padding: ".45rem .62rem", minHeight: "2rem" }}>Preview game layout</span>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#fff1e0", color: "#a45508", fontWeight: 800, fontSize: ".76rem", textTransform: "uppercase", padding: ".45rem .62rem", minHeight: "2rem" }}>All hints visible</span>
              </div>

              <div style={{ borderTop: "1px solid rgba(137, 154, 177, 0.32)", paddingTop: ".75rem" }}>
                <p style={{ margin: "0 0 .45rem", fontFamily: "\"Plus Jakarta Sans\", \"Manrope\", sans-serif", fontSize: ".8rem", letterSpacing: ".08em", textTransform: "uppercase", color: "#4d5b70" }}>Clues</p>
                <ul className="sportle-preview-grid" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridAutoRows: "8.75rem", gap: ".45rem" }}>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", display: "grid", placeItems: "center", textAlign: "center" }}>
                    {previewItem.team_logo_url ? (
                      <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: ".35rem" }}>
                        <img src={previewItem.team_logo_url} alt={previewItem.team_name || "Team logo"} style={{ maxWidth: "100%", maxHeight: "88px", objectFit: "contain", borderRadius: 4 }} />
                        <span>{previewItem.team_name || "Team not revealed"}</span>
                      </div>
                    ) : (
                      <span>{previewItem.team_name || "Team not revealed"}</span>
                    )}
                  </li>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", position: "relative", display: "grid", placeItems: "center", textAlign: "center" }}>
                    <span style={{ position: "absolute", top: ".45rem", left: ".4rem", right: ".4rem", fontSize: ".74rem", textTransform: "uppercase", letterSpacing: ".08em", color: "#a45508", fontWeight: 800 }}>Years played for that team</span>
                    <span>{previewItem.years_with_team || "Unknown"}</span>
                  </li>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", position: "relative", display: "grid", placeItems: "center", textAlign: "center" }}>
                    <span style={{ position: "absolute", top: ".45rem", left: ".4rem", right: ".4rem", fontSize: ".74rem", textTransform: "uppercase", letterSpacing: ".08em", color: "#a45508", fontWeight: 800 }}>Position</span>
                    <span>{previewItem.position || "Unknown"}</span>
                  </li>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", position: "relative", display: "grid", placeItems: "center", textAlign: "center" }}>
                    <span style={{ position: "absolute", top: ".45rem", left: ".4rem", right: ".4rem", fontSize: ".74rem", textTransform: "uppercase", letterSpacing: ".08em", color: "#a45508", fontWeight: 800 }}>Key stat #1</span>
                    <span>{previewItem.key_stat_1 || "Manual stat clue pending"}</span>
                  </li>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", position: "relative", display: "grid", placeItems: "center", textAlign: "center" }}>
                    <span style={{ position: "absolute", top: ".45rem", left: ".4rem", right: ".4rem", fontSize: ".74rem", textTransform: "uppercase", letterSpacing: ".08em", color: "#a45508", fontWeight: 800 }}>Key stat #2 / fact</span>
                    <span>{previewItem.key_stat_2 || "Manual accolade clue pending"}</span>
                  </li>
                  <li style={{ borderRadius: ".7rem", background: "#eaf0f8", border: "1px solid rgba(137, 154, 177, 0.32)", padding: "1.45rem .6rem .6rem", display: "grid", placeItems: "center", textAlign: "center", overflow: "hidden" }}>
                    {previewItem.headshot_url ? (
                      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={previewItem.headshot_url} alt={previewItem.full_name || "Athlete headshot"} style={{ display: "block", width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
                      </div>
                    ) : (
                      <span>Headshot not set</span>
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <div style={{ marginTop: ".75rem", display: "flex", justifyContent: "flex-end" }}>
              <button className="admin-btn" type="button" onClick={() => setPreviewItem(null)}>Close preview</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
