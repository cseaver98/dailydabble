"use client";

import { useState } from "react";

export default function MoviedleAdminTab() {
  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [leadActors, setLeadActors] = useState("");
  const [summary, setSummary] = useState("");
  const [puzzleDate, setPuzzleDate] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importTargetCount, setImportTargetCount] = useState(2000);
  const [importInternational, setImportInternational] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setStatus("");

    if (!title.trim()) {
      setError("Movie title is required.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate.trim())) {
      setError("Puzzle date must be YYYY-MM-DD.");
      return;
    }

    if (!files.length || files.length > 6) {
      setError("Upload between 1 and 6 still images.");
      return;
    }

    setUploading(true);

    try {
      const stillUrls = [];

      for (const file of files) {
        const body = new FormData();
        body.append("file", file);

        const response = await fetch("/api/admin/moviedle/upload-still", {
          method: "POST",
          body,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Failed to upload ${file.name}`);
        }

        if (!payload.url) {
          throw new Error(`No URL returned for ${file.name}`);
        }

        stillUrls.push(payload.url);
      }

      const createResponse = await fetch("/api/admin/moviedle/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          aliases,
          releaseYear,
          leadActors,
          summary,
          puzzleDate,
          stillUrls,
        }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(createPayload.error || "Failed to create puzzle");
      }

      setStatus(`Scheduled "${title}" for ${puzzleDate} with ${stillUrls.length} still(s).`);
      setTitle("");
      setAliases("");
      setReleaseYear("");
      setLeadActors("");
      setSummary("");
      setPuzzleDate("");
      setFiles([]);
      const fileInput = document.getElementById("moviedle-file-input");
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create puzzle.");
    } finally {
      setUploading(false);
    }
  };

  const runOmdbImport = async () => {
    setImportError("");
    setImportStatus("");
    setImporting(true);
    try {
      const response = await fetch("/api/admin/moviedle/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCount: importTargetCount,
          includeInternational: importInternational,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to import OMDb movies");
      }

      setImportStatus(
        `OMDb import complete. Inserted ${payload.inserted || 0}, updated ${payload.updated || 0}, skipped ${payload.skipped || 0}.`,
      );
    } catch (runError) {
      setImportError(runError instanceof Error ? runError.message : "Could not import OMDb movies.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Moviedle Curation</h1>
      <p className="admin-copy">Upload 1-6 stills for a movie and schedule it to a specific date.</p>

      <div
        style={{
          marginTop: ".9rem",
          border: "1px solid #d8dce2",
          borderRadius: 12,
          background: "#f8fafc",
          padding: ".75rem",
          display: "grid",
          gap: ".6rem",
          maxWidth: 700,
        }}
      >
        <p style={{ margin: 0, fontWeight: 900 }}>Bulk import popular movies (OMDb)</p>
        <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
          Imports a capped pool of popular films into the movie library (not the daily schedule).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".65rem", alignItems: "center" }}>
          <label style={{ display: "grid", gap: ".2rem", fontWeight: 700, fontSize: ".86rem" }}>
            Target count
            <input
              type="number"
              min={100}
              max={3000}
              value={importTargetCount}
              onChange={(event) => setImportTargetCount(Number(event.target.value || 2000))}
              style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".45rem .75rem", width: 140 }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", fontWeight: 700, fontSize: ".86rem", marginTop: "1.1rem" }}>
            <input
              type="checkbox"
              checked={importInternational}
              onChange={(event) => setImportInternational(event.target.checked)}
            />
            Include very popular international
          </label>
          <button className="admin-btn primary" type="button" onClick={() => void runOmdbImport()} disabled={importing}>
            {importing ? "Importing..." : "Import OMDb Library"}
          </button>
        </div>
        {importStatus ? <p className="admin-copy" style={{ color: "#2f672d", margin: 0 }}>{importStatus}</p> : null}
        {importError ? <p className="admin-copy" style={{ color: "#8b2d2d", margin: 0 }}>{importError}</p> : null}
      </div>

      <div style={{ display: "grid", gap: ".65rem", marginTop: "1rem", maxWidth: 700 }}>
        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Movie title
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="The Matrix"
            style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".55rem .85rem" }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Aliases (comma-separated)
          <input
            type="text"
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            placeholder="Matrix"
            style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".55rem .85rem" }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Release year (optional)
          <input
            type="number"
            min={1888}
            max={2100}
            value={releaseYear}
            onChange={(event) => setReleaseYear(event.target.value)}
            placeholder="1999"
            style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".55rem .85rem", maxWidth: 220 }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Lead actors (comma-separated, optional)
          <input
            type="text"
            value={leadActors}
            onChange={(event) => setLeadActors(event.target.value)}
            placeholder="Keanu Reeves, Carrie-Anne Moss, Laurence Fishburne"
            style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".55rem .85rem" }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Movie summary (optional)
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="A computer hacker learns about the true nature of his reality..."
            rows={4}
            style={{ borderRadius: 14, border: "1px solid #cfd4da", padding: ".55rem .85rem", resize: "vertical" }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Puzzle date
          <input
            type="date"
            value={puzzleDate}
            onChange={(event) => setPuzzleDate(event.target.value)}
            style={{ borderRadius: 999, border: "1px solid #cfd4da", padding: ".55rem .85rem", maxWidth: 240 }}
          />
        </label>

        <label style={{ display: "grid", gap: ".35rem", fontWeight: 700, fontSize: ".9rem" }}>
          Still images (1-6)
          <input
            id="moviedle-file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 6))}
          />
        </label>

        <div className="admin-actions">
          <button className="admin-btn primary" type="button" disabled={uploading} onClick={() => void handleSubmit()}>
            {uploading ? "Uploading..." : "Create Daily Puzzle"}
          </button>
        </div>
      </div>

      {status ? <p className="admin-copy" style={{ color: "#2f672d", marginTop: ".75rem" }}>{status}</p> : null}
      {error ? <p className="admin-copy" style={{ color: "#8b2d2d", marginTop: ".75rem" }}>{error}</p> : null}
    </section>
  );
}
