"use client";

import { useState } from "react";

export default function MoviedleAdminTab() {
  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [puzzleDate, setPuzzleDate] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

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

  return (
    <section className="admin-card">
      <h1 className="admin-title">Moviedle Curation</h1>
      <p className="admin-copy">Upload 1-6 stills for a movie and schedule it to a specific date.</p>

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
