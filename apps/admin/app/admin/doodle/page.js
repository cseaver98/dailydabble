"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_VALUES = ["pending", "approved", "used"];

const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  used: "Used",
};

const statusDescription = {
  pending: "Uploaded but not approved for game usage yet.",
  approved: "Ready to be selected for upcoming puzzles.",
  used: "Already published in-game.",
};

export default function DoodleAdminTab() {
  const [items, setItems] = useState([]);
  const [queueCounts, setQueueCounts] = useState({ pending: 0, approved: 0, used: 0 });
  const [queueHealth, setQueueHealth] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineOutput, setPipelineOutput] = useState("");
  const [pipelineSummary, setPipelineSummary] = useState(null);
  const [previewSlug, setPreviewSlug] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [deletingSlug, setDeletingSlug] = useState("");
  const [publishingSlug, setPublishingSlug] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [publishError, setPublishError] = useState("");

  const hydrateOverview = (payload) => {
    if (Array.isArray(payload.items)) {
      setItems(payload.items);
      setQueueCounts(payload.queueCounts || { pending: 0, approved: 0, used: 0 });
      setQueueHealth(payload.queueHealth || null);
      return;
    }

    const fallbackFiles = Array.isArray(payload.files) ? payload.files : [];
    setItems(
      fallbackFiles.map((filename) => ({
        filename,
        slug: String(filename).replace(/\.svg$/i, ""),
        status: "pending",
        hasProcessed: false,
        inManifest: false,
        stageCount: 0,
        pathCount: 0,
      })),
    );
    setQueueCounts({ pending: fallbackFiles.length, approved: 0, used: 0 });
    setQueueHealth(null);
  };

  const loadRawFiles = async () => {
    setLoadError("");
    setLoadingFiles(true);
    try {
      const response = await fetch("/api/admin/doodle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not load doodle files");
      }
      hydrateOverview(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load doodle files");
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    void loadRawFiles();
  }, []);

  const onUpload = async () => {
    if (!selectedFile) {
      setUploadError("Choose an SVG file first.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/doodle", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Upload failed");
      }

      setUploadSuccess(`Uploaded ${payload.savedAs}`);
      hydrateOverview(payload);
      setSelectedFile(null);
      const input = document.getElementById("doodle-upload-input");
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const setItemStatus = async (slug, status) => {
    const response = await fetch("/api/admin/doodle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setLoadError(payload.error || "Could not update status");
      return;
    }
    hydrateOverview(payload);
  };

  const deleteItem = async (slug) => {
    const shouldDelete = window.confirm(`Delete "${slug}" from Doodle raw library and generated previews?`);
    if (!shouldDelete) {
      return;
    }

    setDeletingSlug(slug);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/doodle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(payload.error || "Could not delete doodle");
        return;
      }

      hydrateOverview(payload);
      if (previewSlug === slug) {
        closePreview();
      }
    } catch {
      setLoadError("Could not delete doodle");
    } finally {
      setDeletingSlug("");
    }
  };

  const runPipeline = async () => {
    setRunningPipeline(true);
    setPipelineError("");
    setPipelineOutput("");
    try {
      const response = await fetch("/api/admin/doodle/pipeline", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.details || payload.error || "Pipeline failed");
      }

      setPipelineOutput(payload.output || "Pipeline finished.");
      setPipelineSummary(payload.summary || null);
      await loadRawFiles();
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : "Could not run pipeline");
    } finally {
      setRunningPipeline(false);
    }
  };

  const publishItem = async (slug) => {
    setPublishingSlug(slug);
    setPublishError("");
    setPublishMessage("");

    try {
      const response = await fetch("/api/admin/doodle/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPublishError(payload.error || "Could not publish doodle");
        return;
      }

      setPublishMessage(payload.message || `Published ${slug}.`);
      await loadRawFiles();
    } catch {
      setPublishError("Could not publish doodle");
    } finally {
      setPublishingSlug("");
    }
  };

  const openPreview = async (slug) => {
    setPreviewSlug(slug);
    setPreviewItem(null);
    setPreviewError("");
    setPreviewLoading(true);
    setActiveStageIndex(0);
    try {
      const response = await fetch(`/api/admin/doodle?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not load doodle preview");
      }
      setPreviewItem(payload.item || null);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Could not load doodle preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewSlug(null);
    setPreviewItem(null);
    setPreviewError("");
    setPreviewLoading(false);
    setActiveStageIndex(0);
  };

  const groupedItems = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "pending"),
      approved: items.filter((item) => item.status === "approved"),
      used: items.filter((item) => item.status === "used"),
    }),
    [items],
  );

  const processedStages = useMemo(() => {
    const stages = previewItem?.processed?.stages;
    return Array.isArray(stages) ? stages : [];
  }, [previewItem]);

  const stageCount = processedStages.length;
  const boundedStageIndex = Math.min(Math.max(activeStageIndex, 0), Math.max(stageCount - 1, 0));
  const cumulativeStagePaths = useMemo(
    () => processedStages.slice(0, boundedStageIndex + 1).flat(),
    [processedStages, boundedStageIndex],
  );
  const rawSvgDataUrl = useMemo(() => {
    if (!previewItem?.rawSvg) {
      return "";
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(previewItem.rawSvg)}`;
  }, [previewItem]);
  const previewViewBox = previewItem?.processed?.viewBox || "0 0 512 512";

  return (
    <>
      <section className="admin-card">
        <h1 className="admin-title">Doodle Curation</h1>
        <p className="admin-copy">Upload source SVG doodles, review queue status, and preview all reveal stages.</p>

        <div className="admin-actions" style={{ marginTop: "1rem" }}>
          <input
            id="doodle-upload-input"
            type="file"
            accept=".svg,image/svg+xml"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <button className="admin-btn primary" type="button" onClick={() => void onUpload()} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload SVG"}
          </button>
          <button className="admin-btn" type="button" onClick={() => void runPipeline()} disabled={runningPipeline}>
            {runningPipeline ? "Running..." : "Run Staging Pipeline"}
          </button>
        </div>

        {uploadError ? <p className="admin-copy" style={{ color: "#8b2d2d", marginTop: ".55rem" }}>{uploadError}</p> : null}
        {uploadSuccess ? <p className="admin-copy" style={{ color: "#2f672d", marginTop: ".55rem" }}>{uploadSuccess}</p> : null}
        {pipelineError ? <p className="admin-copy" style={{ color: "#8b2d2d", marginTop: ".55rem" }}>{pipelineError}</p> : null}
        {pipelineOutput ? (
          <p className="admin-copy" style={{ color: "#2f672d", marginTop: ".55rem", whiteSpace: "pre-wrap" }}>{pipelineOutput}</p>
        ) : null}
        {publishError ? <p className="admin-copy" style={{ color: "#8b2d2d", marginTop: ".55rem" }}>{publishError}</p> : null}
        {publishMessage ? <p className="admin-copy" style={{ color: "#2f672d", marginTop: ".55rem" }}>{publishMessage}</p> : null}

        {pipelineSummary ? (
          <div style={{ marginTop: ".75rem", border: "1px solid #d8dce2", borderRadius: 12, padding: ".7rem .8rem", background: "#f8fafc" }}>
            <p style={{ margin: 0, fontWeight: 800 }}>Generated set</p>
            <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
              Items: <b>{pipelineSummary.itemCount ?? 0}</b>
              {pipelineSummary.generatedAt ? <> | Generated: <b>{new Date(pipelineSummary.generatedAt).toLocaleString()}</b></> : null}
            </p>
            {Array.isArray(pipelineSummary.slugs) && pipelineSummary.slugs.length > 0 ? (
              <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
                Slugs: <b>{pipelineSummary.slugs.join(", ")}</b>
              </p>
            ) : null}
          </div>
        ) : null}

        {queueHealth ? (
          <div style={{ marginTop: ".95rem", border: "1px solid #d8dce2", borderRadius: 12, padding: ".7rem .8rem", background: "#f8fafc" }}>
            <p style={{ margin: 0, fontWeight: 800 }}>Queue Health</p>
            <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
              Runway: <b>{queueHealth.runwayDays || 0}</b> day(s) | Approved (ready): <b>{queueHealth.approvedProcessed || 0}</b> |
              Approved (needs pipeline): <b>{queueHealth.approvedUnprocessed || 0}</b> | Pending: <b>{queueHealth.pending || 0}</b> |
              Pending (already staged): <b>{queueHealth.pendingProcessed || 0}</b> | Used: <b>{queueHealth.used || 0}</b> |
              Total: <b>{queueHealth.total || 0}</b>
            </p>
          </div>
        ) : null}

        <div style={{ marginTop: ".95rem", border: "1px solid #d8dce2", borderRadius: 12, padding: ".7rem .8rem", background: "#f8fafc" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Queue Summary</p>
          <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
            Pending: <b>{queueCounts.pending || 0}</b> | Approved: <b>{queueCounts.approved || 0}</b> | Used: <b>{queueCounts.used || 0}</b>
          </p>
        </div>

        {loadingFiles ? <p className="admin-copy">Loading SVG files...</p> : null}
        {!loadingFiles && loadError ? <p className="admin-copy" style={{ color: "#8b2d2d" }}>{loadError}</p> : null}
        {!loadingFiles && !loadError && items.length === 0 ? <p className="admin-copy">No SVGs uploaded yet.</p> : null}

        {!loadingFiles && !loadError && items.length > 0 ? (
          <div style={{ marginTop: ".9rem", display: "grid", gap: ".8rem" }}>
            {STATUS_VALUES.map((status) => (
              <div key={status} style={{ border: "1px solid #d8dce2", borderRadius: 14, padding: ".7rem", background: "#fff" }}>
                <p style={{ margin: 0, fontWeight: 900 }}>{statusLabel[status]} ({groupedItems[status].length})</p>
                <p style={{ margin: ".25rem 0 .6rem", color: "#5b6168", fontSize: ".88rem" }}>{statusDescription[status]}</p>

                {groupedItems[status].length === 0 ? (
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>No items in this queue.</p>
                ) : (
                  <div style={{ display: "grid", gap: ".55rem" }}>
                    {groupedItems[status].map((item) => (
                      <article key={item.slug} style={{ border: "1px solid #e4e8ee", borderRadius: 12, padding: ".65rem .7rem", background: "#fdfefe" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 900 }}>{item.slug}</p>
                            <p style={{ margin: ".22rem 0 0", color: "#5b6168", fontSize: ".84rem" }}>
                              File: {item.filename} | Processed: {item.hasProcessed ? "yes" : "no"} | Stages: {item.stageCount || 0} | Paths: {item.pathCount || 0}
                            </p>
                            <p style={{ margin: ".16rem 0 0", color: "#5b6168", fontSize: ".84rem" }}>
                              In manifest: {item.inManifest ? "yes" : "no"} | Preview html: {item.previewReady ? "yes" : "no"}
                            </p>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", alignItems: "start" }}>
                            <button className="admin-btn" type="button" onClick={() => void openPreview(item.slug)}>
                              Preview
                            </button>
                            <button
                              className="admin-btn primary"
                              type="button"
                              onClick={() => void publishItem(item.slug)}
                              disabled={
                                publishingSlug === item.slug ||
                                !item.hasProcessed ||
                                item.status !== "approved"
                              }
                            >
                              {publishingSlug === item.slug ? "Publishing..." : "Publish Next Day"}
                            </button>
                            <button
                              className="admin-btn"
                              type="button"
                              onClick={() => void deleteItem(item.slug)}
                              disabled={deletingSlug === item.slug}
                              style={{
                                borderColor: "#b42318",
                                color: "#b42318",
                                background: deletingSlug === item.slug ? "#fef2f2" : undefined,
                              }}
                            >
                              {deletingSlug === item.slug ? "Deleting..." : "Delete"}
                            </button>
                            {STATUS_VALUES.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                className="admin-btn"
                                type="button"
                                onClick={() => void setItemStatus(item.slug, nextStatus)}
                                style={{
                                  borderColor: item.status === nextStatus ? "#2f672d" : undefined,
                                  background: item.status === nextStatus ? "#d1ffc7" : undefined,
                                }}
                              >
                                {statusLabel[nextStatus]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {previewSlug ? (
        <div
          onClick={closePreview}
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
              width: "min(980px, 96vw)",
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
                <p style={{ margin: 0, fontWeight: 900 }}>{previewSlug}</p>
                <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                  Original SVG and generated reveal stages
                </p>
              </div>
              <button className="admin-btn" type="button" onClick={closePreview}>Close</button>
            </div>

            {previewLoading ? <p className="admin-copy">Loading preview...</p> : null}
            {previewError ? <p className="admin-copy" style={{ color: "#8b2d2d" }}>{previewError}</p> : null}

            {!previewLoading && !previewError && previewItem ? (
              <div style={{ marginTop: ".75rem", display: "grid", gap: ".75rem" }}>
                <div style={{ border: "1px solid #d8dce2", borderRadius: 14, padding: ".55rem", background: "#f8fafc" }}>
                  <p style={{ margin: "0 0 .45rem", fontWeight: 800 }}>Original SVG</p>
                  {rawSvgDataUrl ? (
                    <img
                      src={rawSvgDataUrl}
                      alt={`${previewSlug} original`}
                      style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 10, background: "#fff" }}
                    />
                  ) : (
                    <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>No raw SVG found.</p>
                  )}
                </div>

                <div style={{ border: "1px solid #d8dce2", borderRadius: 14, padding: ".55rem", background: "#f8fafc" }}>
                  <p style={{ margin: "0 0 .35rem", fontWeight: 800 }}>Reveal Stages</p>
                  {stageCount === 0 ? (
                    <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                      No processed stages yet. Run the staging pipeline first.
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 .45rem", color: "#5b6168", fontSize: ".84rem" }}>
                        Stage {boundedStageIndex + 1} of {stageCount} (cumulative preview)
                      </p>
                      <div style={{ border: "1px solid #d8dce2", borderRadius: 12, padding: ".55rem", background: "#fff" }}>
                        <svg viewBox={previewViewBox} style={{ width: "100%", maxHeight: 360, display: "block" }} aria-label="Stage preview">
                          {cumulativeStagePaths.map((path, index) => (
                            <path
                              key={`${boundedStageIndex}-${index}`}
                              d={path}
                              fill="none"
                              stroke="#1f4f80"
                              strokeWidth="7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ))}
                        </svg>
                      </div>

                      <div style={{ marginTop: ".6rem", display: "flex", flexWrap: "wrap", gap: ".42rem" }}>
                        {processedStages.map((stagePaths, index) => (
                          <button
                            key={`stage-${index + 1}`}
                            className="admin-btn"
                            type="button"
                            onClick={() => setActiveStageIndex(index)}
                            style={{
                              borderColor: boundedStageIndex === index ? "#2f672d" : undefined,
                              background: boundedStageIndex === index ? "#d1ffc7" : undefined,
                            }}
                          >
                            Stage {index + 1} ({Array.isArray(stagePaths) ? stagePaths.length : 0})
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
