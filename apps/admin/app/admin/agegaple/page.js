"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const statuses = ["pending_review", "approved", "rejected"];
const batchSizeOptions = [1, 5, 10, 15, 20];
const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><rect width="800" height="520" fill="#eef1f4"/><g fill="none" stroke="#c6ccd3" stroke-width="8"><rect x="140" y="96" width="520" height="328" rx="24"/><path d="M178 362 304 238l92 90 98-116 128 150"/><circle cx="300" cy="188" r="28"/></g><text x="400" y="466" text-anchor="middle" fill="#7c8590" font-family="Arial, Helvetica, sans-serif" font-size="28">No image</text></svg>`,
)}`;

export default function AgegapleAdminTab() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [batchSize, setBatchSize] = useState(5);
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [seedError, setSeedError] = useState("");
  const [seedOutput, setSeedOutput] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);

  const [galleryCandidateId, setGalleryCandidateId] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [removeImageError, setRemoveImageError] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageTitle, setNewImageTitle] = useState("");
  const [newImageAttribution, setNewImageAttribution] = useState("");
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [addImageError, setAddImageError] = useState("");

  const load = async () => {
    try {
      setError("");
      const response = await fetch("/api/admin/candidates", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load candidates");
      }
      const data = await response.json();
      setItems(data.items || []);
      setQueueHealth(data.queueHealth || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load review candidates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => Number(b.qualityScore) - Number(a.qualityScore));
    if (statusFilter === "all") {
      return sorted;
    }
    return sorted.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const galleryCandidate = useMemo(
    () => items.find((item) => item.id === galleryCandidateId) ?? null,
    [items, galleryCandidateId],
  );

  const galleryImages = galleryCandidate?.galleryImages ?? [];
  const activeGalleryImage = galleryImages[galleryIndex] ?? galleryImages[0] ?? null;
  const canNavigateGallery = galleryImages.length > 1;

  useEffect(() => {
    if (!galleryImages.length) {
      setGalleryIndex(0);
      return;
    }
    if (galleryIndex >= galleryImages.length) {
      setGalleryIndex(galleryImages.length - 1);
    }
  }, [galleryImages.length, galleryIndex]);

  const patchStatus = async (id, status) => {
    setError("");
    const response = await fetch("/api/admin/candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Failed to update status");
      return;
    }

    await load();
  };

  const runSeed = async () => {
    setSeedError("");
    setSeedOutput("");
    setIsSeeding(true);
    try {
      const response = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSeedError(payload.details || payload.error || "Seed failed");
        return;
      }
      setSeedOutput(payload.output || "Seed finished.");
      await load();
    } catch {
      setSeedError("Could not start batch seed.");
    } finally {
      setIsSeeding(false);
    }
  };

  const openGallery = (candidateId) => {
    setGalleryCandidateId(candidateId);
    setGalleryIndex(0);
    setRemoveImageError("");
    setAddImageError("");
  };

  const closeGallery = () => {
    setGalleryCandidateId(null);
    setGalleryIndex(0);
    setRemoveImageError("");
    setAddImageError("");
  };

  const removeActiveImage = async () => {
    if (!activeGalleryImage || String(activeGalleryImage.id).startsWith("fallback-")) {
      setRemoveImageError("This image cannot be removed from here.");
      return;
    }

    setRemoveImageError("");
    setIsRemovingImage(true);

    try {
      const response = await fetch("/api/admin/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: activeGalleryImage.id }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRemoveImageError(payload.error || "Failed to remove image");
        return;
      }

      await load();
      setGalleryIndex(0);
    } catch {
      setRemoveImageError("Could not remove image.");
    } finally {
      setIsRemovingImage(false);
    }
  };

  const addImageToGallery = async () => {
    if (!galleryCandidate || !newImageUrl.trim()) {
      setAddImageError("Image URL is required.");
      return;
    }

    setAddImageError("");
    setIsAddingImage(true);

    try {
      const response = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupleId: galleryCandidate.coupleId,
          imageUrl: newImageUrl.trim(),
          fileTitle: newImageTitle.trim() || undefined,
          attributionText: newImageAttribution.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAddImageError(payload.error || "Failed to add image");
        return;
      }

      setNewImageUrl("");
      setNewImageTitle("");
      setNewImageAttribution("");
      await load();
      setGalleryIndex(0);
    } catch {
      setAddImageError("Could not add image.");
    } finally {
      setIsAddingImage(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const getAttachedPhotos = (item) =>
    (item.galleryImages || []).filter((image) => image?.id && !String(image.id).startsWith("fallback-"));

  const getCardImageUrl = (item) => {
    const attached = getAttachedPhotos(item);
    if (attached.length > 0 && attached[0].imageUrl) {
      return attached[0].imageUrl;
    }
    return item.imageUrl || PLACEHOLDER_IMAGE;
  };

  return (
    <>
      <section className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
          <div>
            <h1 className="admin-title">Agegaple Curation</h1>
            <p className="admin-copy">Review candidates, update status, and seed new suggestions.</p>
          </div>
          <button className="admin-btn" type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>

        {queueHealth ? (
          <div style={{ marginTop: ".9rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".7rem .8rem", background: "#f8fafc" }}>
            <p style={{ margin: 0, fontWeight: 800 }}>Queue Health</p>
            <p style={{ margin: ".35rem 0 0", color: "#5b6168", fontSize: ".9rem" }}>
              Runway: <b>{queueHealth.runwayDays}</b> day(s) | Approved unused: <b>{queueHealth.approvedUnused}</b> |
              Approved used: <b>{queueHealth.approvedUsed}</b> | Pending: <b>{queueHealth.pending}</b> | Rejected: <b>{queueHealth.rejected}</b>
            </p>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "end", marginTop: ".9rem" }}>
          <label style={{ fontWeight: 700, fontSize: ".9rem" }}>
            Batch size
            <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} style={{ marginLeft: ".45rem" }}>
              {batchSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button className="admin-btn primary" type="button" onClick={() => void runSeed()} disabled={isSeeding}>
            {isSeeding ? "Seeding..." : `Start Batch Seed (${batchSize})`}
          </button>
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

        {seedError ? <p style={{ marginTop: ".55rem", color: "#b42318", fontWeight: 700 }}>{seedError}</p> : null}
        {seedOutput ? <pre style={{ marginTop: ".55rem", maxHeight: 200, overflow: "auto", background: "#f8fafc", borderRadius: 10, padding: ".55rem" }}>{seedOutput}</pre> : null}
        {error ? <p style={{ marginTop: ".6rem", color: "#b42318", fontWeight: 700 }}>{error}</p> : null}
        {loading ? <p className="admin-copy">Loading candidates...</p> : null}

        <div style={{ marginTop: ".9rem", display: "grid", gap: ".65rem" }}>
          {visibleItems.map((item) => (
            (() => {
              const attachedPhotos = getAttachedPhotos(item);
              const attachedPhotoCount = attachedPhotos.length;
              return (
            <article key={item.id} style={{ border: "1px solid #d8dce2", borderRadius: 14, background: "#fff", padding: ".75rem" }}>
              <div style={{ display: "grid", gap: ".7rem", gridTemplateColumns: "140px 1fr" }}>
                <img
                  src={getCardImageUrl(item)}
                  alt={item.couple}
                  style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 10, cursor: "zoom-in" }}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                  onClick={() => openGallery(item.id)}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>{item.couple}</p>
                  <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
                    Gap: {item.roundedAgeGapYears} years | Score: {item.qualityScore} | Status: {item.status}
                  </p>
                  <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
                    Attached photos: {attachedPhotoCount}
                  </p>
                  <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
                    Usage: {item.usedCount === 0 ? "Not used yet" : `${item.usedCount}x (last ${item.lastUsedPuzzleDate})`}
                  </p>
                  <div style={{ marginTop: ".45rem", display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                    <button className="admin-btn" type="button" onClick={() => openGallery(item.id)}>Manage photos</button>
                    {statuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="admin-btn"
                        onClick={() => void patchStatus(item.id, status)}
                        style={{
                          borderColor: item.status === status ? "#2f672d" : undefined,
                          background: item.status === status ? "#d1ffc7" : undefined,
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </article>
              );
            })()
          ))}
          {!loading && visibleItems.length === 0 ? <p className="admin-copy">No candidates in this filter yet.</p> : null}
        </div>
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
                <p style={{ margin: 0, fontWeight: 900 }}>{galleryCandidate.couple}</p>
                <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                  Gallery image {galleryImages.length ? Math.min(galleryIndex + 1, galleryImages.length) : 0} of {galleryImages.length}
                </p>
              </div>
              <button className="admin-btn" type="button" onClick={closeGallery}>Close</button>
            </div>

            <div style={{ marginTop: ".75rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".55rem", background: "#f8fafc" }}>
              <img
                src={activeGalleryImage?.imageUrl || PLACEHOLDER_IMAGE}
                alt={activeGalleryImage?.imageAlt || "Gallery image"}
                style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 10, background: "#fff" }}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
              />
              {canNavigateGallery ? (
                <div style={{ marginTop: ".55rem", display: "flex", gap: ".45rem", justifyContent: "space-between" }}>
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => setGalleryIndex((current) => Math.max(0, current - 1))}
                    disabled={galleryIndex <= 0}
                  >
                    Previous
                  </button>
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => setGalleryIndex((current) => Math.min(galleryImages.length - 1, current + 1))}
                    disabled={galleryIndex >= galleryImages.length - 1}
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
                  onClick={() => void removeActiveImage()}
                  disabled={isRemovingImage || !activeGalleryImage}
                >
                  {isRemovingImage ? "Removing..." : "Remove active image"}
                </button>
                <p style={{ margin: 0, fontSize: ".83rem", color: "#5b6168" }}>
                  Fallback image entries cannot be deleted directly.
                </p>
              </div>
              {removeImageError ? <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{removeImageError}</p> : null}

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: ".6rem", display: "grid", gap: ".5rem" }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Add image to gallery</p>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  Image URL
                  <input
                    value={newImageUrl}
                    onChange={(event) => setNewImageUrl(event.target.value)}
                    placeholder="https://..."
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  Title (optional)
                  <input
                    value={newImageTitle}
                    onChange={(event) => setNewImageTitle(event.target.value)}
                    placeholder="File title"
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  Attribution (optional)
                  <input
                    value={newImageAttribution}
                    onChange={(event) => setNewImageAttribution(event.target.value)}
                    placeholder="Source / author"
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <div>
                  <button className="admin-btn primary" type="button" onClick={() => void addImageToGallery()} disabled={isAddingImage}>
                    {isAddingImage ? "Adding..." : "Add image"}
                  </button>
                </div>
                {addImageError ? <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{addImageError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
