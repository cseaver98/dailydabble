"use client";

import { useEffect, useState } from "react";
import QueueHealthPanel from "../components/queue-health-panel";

const statuses = ["pending_review", "approved", "finished"];
const filterStatuses = ["pending_review", "approved", "today", "finished", "all"];
const candidatePageSize = 10;
const statusLabel = (status) => (status === "pending_review" ? "pending" : status);
const monthOptions = [
  ["", "Month"],
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];
const formatEventDate = (month, day, year) => {
  const numericYear = Number(year);
  if (!Number.isFinite(numericYear)) {
    return "Date unknown";
  }
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (!Number.isFinite(numericMonth) || !Number.isFinite(numericDay) || numericMonth < 1 || numericDay < 1) {
    return String(numericYear);
  }
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, numericMonth - 1, numericDay)),
  );
  return `${monthDay}, ${numericYear}`;
};
const getScheduleWarningCopy = (item) => {
  if (!item?.scheduleDateWarning) {
    return "";
  }
  if (item.scheduleDateWarning === "missing_event_date") {
    return "Scheduled, but event month/day has not been set yet.";
  }
  return `Scheduled for ${item.scheduleDateWarning}, but event date is ${formatEventDate(item.event_month, item.event_day, item.event_year)}.`;
};

export default function YeardleAdminTab() {
  const [manualUrl, setManualUrl] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualMonth, setManualMonth] = useState("");
  const [manualDay, setManualDay] = useState("");
  const [manualCandidate, setManualCandidate] = useState(null);
  const [isEditingManualCandidate, setIsEditingManualCandidate] = useState(false);
  const [isLookingUpManualCandidate, setIsLookingUpManualCandidate] = useState(false);
  const [isAddingManualCandidate, setIsAddingManualCandidate] = useState(false);
  const [isUploadingManualCandidateImage, setIsUploadingManualCandidateImage] = useState(false);
  const [manualCommonsUrl, setManualCommonsUrl] = useState("");
  const [isLookingUpManualImage, setIsLookingUpManualImage] = useState(false);

  const [items, setItems] = useState([]);
  const [queueHealth, setQueueHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [editingCandidateDraft, setEditingCandidateDraft] = useState(null);
  const [savingCandidateId, setSavingCandidateId] = useState("");
  const [photoPreviewCandidate, setPhotoPreviewCandidate] = useState(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState("");
  const [photoDraftAlt, setPhotoDraftAlt] = useState("");
  const [photoDraftSourcePageUrl, setPhotoDraftSourcePageUrl] = useState("");
  const [photoDraftFileTitle, setPhotoDraftFileTitle] = useState("");
  const [photoDraftLicense, setPhotoDraftLicense] = useState("");
  const [photoDraftLicenseUrl, setPhotoDraftLicenseUrl] = useState("");
  const [photoDraftAuthor, setPhotoDraftAuthor] = useState("");
  const [photoDraftAttributionText, setPhotoDraftAttributionText] = useState("");
  const [photoDraftLicenseVerified, setPhotoDraftLicenseVerified] = useState(false);
  const [photoCommonsUrl, setPhotoCommonsUrl] = useState("");
  const [isLookingUpPhotoImage, setIsLookingUpPhotoImage] = useState(false);
  const [savingPhotoCandidateId, setSavingPhotoCandidateId] = useState("");
  const [uploadingPhotoCandidateId, setUploadingPhotoCandidateId] = useState("");
  const [deletingPhotoCandidateId, setDeletingPhotoCandidateId] = useState("");

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
      setManualMonth(payload?.candidate?.eventMonthGuess ? String(payload.candidate.eventMonthGuess) : "");
      setManualDay(payload?.candidate?.eventDayGuess ? String(payload.candidate.eventDayGuess) : "");
      setManualCommonsUrl(String(payload?.candidate?.imageSourcePageUrl || payload?.candidate?.imageUrl || ""));
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
      const eventMonth = manualMonth ? Number(manualMonth) : null;
      const eventDay = manualDay ? Number(manualDay) : null;
      if (!Number.isFinite(eventYear) || eventYear < 1000 || eventYear > new Date().getFullYear()) {
        throw new Error("Enter a valid event year.");
      }
      if ((eventMonth === null) !== (eventDay === null)) {
        throw new Error("Enter both event month and day, or leave both blank.");
      }

      const normalizedTitle = String(manualCandidate.title || "").trim();
      const normalizedImageUrl = String(manualCandidate.imageUrl || "").trim();
      const normalizedDescription = String(manualCandidate.description || "").trim();
      if (!normalizedTitle) {
        throw new Error("Title is required.");
      }
      if (!normalizedImageUrl) {
        throw new Error("Image URL is required.");
      }
      if (!normalizedDescription) {
        throw new Error("Description is required.");
      }

      const payloadCandidate = {
        ...manualCandidate,
        title: normalizedTitle,
        imageUrl: normalizedImageUrl,
        imageAlt: `${normalizedTitle} historical image`,
        description: normalizedDescription,
      };

      const response = await fetch("/api/admin/yeardle/title-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: payloadCandidate,
          eventYear,
          eventMonth,
          eventDay,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.duplicateWarning) {
          window.alert(payload.duplicateWarning);
          return;
        }
        throw new Error(payload.error || "Failed to add manual candidate");
      }

      setMessage(`Added ${manualCandidate.title} as a pending candidate.`);
      setManualCandidate(null);
      setManualYear("");
      setManualMonth("");
      setManualDay("");
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
    setManualMonth("");
    setManualDay("");
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

  const uploadManualCandidateImage = async (file) => {
    if (!(file instanceof File)) {
      return;
    }
    if (!manualCandidate) {
      return;
    }

    setIsUploadingManualCandidateImage(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/admin/yeardle/upload-image", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload.error || "Failed to upload image");
      }

      updateManualCandidateField("imageUrl", payload.url);
      updateManualCandidateField("imageSourcePageUrl", "");
      updateManualCandidateField("imageFileTitle", "");
      updateManualCandidateField("imageLicense", "");
      updateManualCandidateField("imageLicenseUrl", "");
      updateManualCandidateField("imageAuthor", "");
      updateManualCandidateField("imageAttributionText", "");
      setMessage("Image uploaded and ready for this candidate.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload image.");
    } finally {
      setIsUploadingManualCandidateImage(false);
    }
  };

  const lookupManualCommonsImage = async () => {
    if (!manualCandidate) {
      return;
    }
    const sourceUrl = String(manualCommonsUrl || manualCandidate.imageUrl || "").trim();
    if (!sourceUrl) {
      setError("Paste a Wikimedia Commons file URL.");
      return;
    }

    setIsLookingUpManualImage(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/images/commons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.metadata) {
        throw new Error(payload.error || "Could not load Commons image metadata.");
      }
      const metadata = payload.metadata;
      setManualCandidate((current) => current ? {
        ...current,
        imageUrl: metadata.thumbUrl || metadata.imageUrl || current.imageUrl,
        imageAlt: metadata.objectName || metadata.fileTitle || current.imageAlt,
        imageSourcePageUrl: metadata.sourcePageUrl || sourceUrl,
        imageFileTitle: metadata.fileTitle || "",
        imageLicense: metadata.license || "",
        imageLicenseUrl: metadata.licenseUrl || "",
        imageAuthor: metadata.author || "",
        imageAttributionText: metadata.attributionText || "",
      } : current);
      setManualCommonsUrl(metadata.sourcePageUrl || sourceUrl);
      setMessage("Wikimedia image metadata filled.");
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Could not load Commons image metadata.");
    } finally {
      setIsLookingUpManualImage(false);
    }
  };

  const patchStatus = async (id, status, confirmDuplicate = false) => {
    if (status === "finished") {
      return;
    }
    setError("");
    const response = await fetch("/api/admin/yeardle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id, status, confirmDuplicate }),
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

  const beginEditCandidate = (item) => {
    setEditingCandidateId(item.id);
    setEditingCandidateDraft({
      title: String(item.title || ""),
      eventYear: String(item.event_year || ""),
      eventMonth: item.event_month ? String(item.event_month) : "",
      eventDay: item.event_day ? String(item.event_day) : "",
      description: String(item.hint_description || ""),
      wikipediaUrl: String(item.wikipedia_url || ""),
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
      const response = await fetch("/api/admin/yeardle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: candidateId,
          candidate: {
            title: editingCandidateDraft.title,
            eventYear: Number(editingCandidateDraft.eventYear),
            eventMonth: editingCandidateDraft.eventMonth ? Number(editingCandidateDraft.eventMonth) : null,
            eventDay: editingCandidateDraft.eventDay ? Number(editingCandidateDraft.eventDay) : null,
            description: editingCandidateDraft.description,
            wikipediaUrl: editingCandidateDraft.wikipediaUrl,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update candidate");
      }

      setMessage("Candidate details updated.");
      cancelEditCandidate();
      await load({ page: currentPage, status: statusFilter });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update candidate.");
    } finally {
      setSavingCandidateId("");
    }
  };

  const openPhotoPreview = (candidate) => {
    setPhotoPreviewCandidate(candidate);
    setPhotoDraftUrl(String(candidate?.image_url || ""));
    setPhotoDraftAlt(String(candidate?.image_alt || `${candidate?.title || "Yeardle event"} historical image`));
    setPhotoDraftSourcePageUrl(String(candidate?.image_source_page_url || ""));
    setPhotoDraftFileTitle(String(candidate?.image_file_title || ""));
    setPhotoDraftLicense(String(candidate?.image_license || ""));
    setPhotoDraftLicenseUrl(String(candidate?.image_license_url || ""));
    setPhotoDraftAuthor(String(candidate?.image_author || ""));
    setPhotoDraftAttributionText(String(candidate?.image_attribution_text || ""));
    setPhotoDraftLicenseVerified(Boolean(candidate?.image_license_verified_at));
    setPhotoCommonsUrl(String(candidate?.image_source_page_url || ""));
  };

  const closePhotoPreview = () => {
    setPhotoPreviewCandidate(null);
    setPhotoDraftUrl("");
    setPhotoDraftAlt("");
    setPhotoDraftSourcePageUrl("");
    setPhotoDraftFileTitle("");
    setPhotoDraftLicense("");
    setPhotoDraftLicenseUrl("");
    setPhotoDraftAuthor("");
    setPhotoDraftAttributionText("");
    setPhotoDraftLicenseVerified(false);
    setPhotoCommonsUrl("");
  };

  const savePreviewPhoto = async () => {
    if (!photoPreviewCandidate) {
      return;
    }
    const normalizedImageUrl = String(photoDraftUrl || "").trim();
    if (!normalizedImageUrl) {
      setError("Image URL is required unless you delete the current image.");
      return;
    }

    setSavingPhotoCandidateId(photoPreviewCandidate.id);
    setError("");
    try {
      const response = await fetch("/api/admin/yeardle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: photoPreviewCandidate.id,
          imageUrl: normalizedImageUrl,
          imageAlt: photoDraftAlt.trim() || `${photoPreviewCandidate.title} historical image`,
          imageSourcePageUrl: photoDraftSourcePageUrl.trim() || null,
          imageFileTitle: photoDraftFileTitle.trim() || null,
          imageLicense: photoDraftLicense.trim() || null,
          imageLicenseUrl: photoDraftLicenseUrl.trim() || null,
          imageAuthor: photoDraftAuthor.trim() || null,
          imageAttributionText: photoDraftAttributionText.trim() || null,
          imageLicenseVerified: photoDraftLicenseVerified,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update image");
      }

      setMessage("Candidate image updated.");
      await load({ page: currentPage, status: statusFilter });
      setPhotoPreviewCandidate((current) => (current ? {
        ...current,
        image_url: normalizedImageUrl,
        image_alt: photoDraftAlt.trim() || `${current.title} historical image`,
        image_source_page_url: photoDraftSourcePageUrl.trim() || null,
        image_file_title: photoDraftFileTitle.trim() || null,
        image_license: photoDraftLicense.trim() || null,
        image_license_url: photoDraftLicenseUrl.trim() || null,
        image_author: photoDraftAuthor.trim() || null,
        image_attribution_text: photoDraftAttributionText.trim() || null,
        image_license_verified_at: photoDraftLicenseVerified ? new Date().toISOString() : null,
      } : current));
      setPhotoDraftUrl(normalizedImageUrl);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update image.");
    } finally {
      setSavingPhotoCandidateId("");
    }
  };

  const uploadPreviewPhoto = async (file) => {
    if (!(file instanceof File) || !photoPreviewCandidate) {
      return;
    }

    setUploadingPhotoCandidateId(photoPreviewCandidate.id);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/yeardle/upload-image", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload.error || "Failed to upload image");
      }

      setPhotoDraftUrl(String(payload.url));
      setPhotoDraftSourcePageUrl("");
      setPhotoDraftFileTitle("");
      setPhotoDraftLicense("");
      setPhotoDraftLicenseUrl("");
      setPhotoDraftAuthor("");
      setPhotoDraftAttributionText("");
      setPhotoDraftLicenseVerified(false);
      setMessage("Image uploaded. Click save photo to apply.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload image.");
    } finally {
      setUploadingPhotoCandidateId("");
    }
  };

  const lookupPhotoCommonsImage = async () => {
    if (!photoPreviewCandidate) {
      return;
    }
    const sourceUrl = String(photoCommonsUrl || photoDraftUrl || "").trim();
    if (!sourceUrl) {
      setError("Paste a Wikimedia Commons file URL.");
      return;
    }

    setIsLookingUpPhotoImage(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/images/commons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.metadata) {
        throw new Error(payload.error || "Could not load Commons image metadata.");
      }
      const metadata = payload.metadata;
      setPhotoDraftUrl(metadata.thumbUrl || metadata.imageUrl || photoDraftUrl);
      setPhotoDraftAlt(metadata.objectName || metadata.fileTitle || `${photoPreviewCandidate.title} historical image`);
      setPhotoDraftSourcePageUrl(metadata.sourcePageUrl || sourceUrl);
      setPhotoDraftFileTitle(metadata.fileTitle || "");
      setPhotoDraftLicense(metadata.license || "");
      setPhotoDraftLicenseUrl(metadata.licenseUrl || "");
      setPhotoDraftAuthor(metadata.author || "");
      setPhotoDraftAttributionText(metadata.attributionText || "");
      setPhotoDraftLicenseVerified(false);
      setPhotoCommonsUrl(metadata.sourcePageUrl || sourceUrl);
      setMessage("Wikimedia image metadata filled. Review it, then save photo.");
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Could not load Commons image metadata.");
    } finally {
      setIsLookingUpPhotoImage(false);
    }
  };

  const deletePreviewPhoto = async () => {
    if (!photoPreviewCandidate) {
      return;
    }
    const shouldDelete = window.confirm("Delete the current image for this candidate?");
    if (!shouldDelete) {
      return;
    }

    setDeletingPhotoCandidateId(photoPreviewCandidate.id);
    setError("");
    try {
      const response = await fetch("/api/admin/yeardle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: photoPreviewCandidate.id, clearImage: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete image");
      }

      setMessage("Candidate image deleted.");
      await load({ page: currentPage, status: statusFilter });
      setPhotoPreviewCandidate((current) => (current ? { ...current, image_url: "" } : current));
      setPhotoDraftUrl("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete image.");
    } finally {
      setDeletingPhotoCandidateId("");
    }
  };

  return (
    <section className="admin-card">
      <h1 className="admin-title">Yeardle Curation</h1>
      <p className="admin-copy">Review event candidates and keep the approved queue healthy for daily auto-assignment.</p>

      <QueueHealthPanel queueHealth={queueHealth} />

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
                    Description
                    <textarea
                      value={manualCandidate.description || ""}
                      onChange={(event) => updateManualCandidateField("description", event.target.value)}
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
                  <div style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".55rem", background: "#f8fafc", display: "grid", gap: ".4rem" }}>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Wikimedia Commons URL
                      <input
                        type="text"
                        value={manualCommonsUrl}
                        onChange={(event) => setManualCommonsUrl(event.target.value)}
                        placeholder="https://commons.wikimedia.org/wiki/File:..."
                        style={{ marginLeft: ".35rem", minWidth: 360 }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        className="admin-btn"
                        type="button"
                        onClick={() => void lookupManualCommonsImage()}
                        disabled={isLookingUpManualImage}
                      >
                        {isLookingUpManualImage ? "Looking up..." : "Use Wikimedia image"}
                      </button>
                      {manualCandidate.imageLicense ? (
                        <span style={{ color: "#5b6168", fontSize: ".82rem", fontWeight: 700 }}>
                          {manualCandidate.imageLicense}{manualCandidate.imageAuthor ? ` | ${manualCandidate.imageAuthor}` : ""}
                        </span>
                      ) : null}
                    </div>
                    <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                      Attribution
                      <input
                        type="text"
                        value={manualCandidate.imageAttributionText || ""}
                        onChange={(event) => updateManualCandidateField("imageAttributionText", event.target.value)}
                        placeholder="Title | Author | License"
                        style={{ marginLeft: ".35rem", minWidth: 360 }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}>
                    <label className="admin-btn" style={{ cursor: "pointer" }}>
                      {isUploadingManualCandidateImage ? "Uploading..." : "Upload JPG/PNG"}
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        style={{ display: "none" }}
                        disabled={isUploadingManualCandidateImage || isAddingManualCandidate}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadManualCandidateImage(file);
                          }
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 900 }}>{manualCandidate.title}</p>
                  <p style={{ margin: ".2rem 0", color: "#5b6168", fontSize: ".86rem" }}>
                    {manualCandidate.description}
                  </p>
                  {manualCandidate.imageAttributionText ? (
                    <p style={{ margin: ".16rem 0 0", color: "#5b6168", fontSize: ".78rem" }}>
                      Image: {manualCandidate.imageAttributionText}
                    </p>
                  ) : null}
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
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event month
                  <select
                    value={manualMonth}
                    onChange={(event) => setManualMonth(event.target.value)}
                    style={{ marginLeft: ".35rem" }}
                  >
                    {monthOptions.map(([value, label]) => (
                      <option key={value || "empty"} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event day
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={manualDay}
                    onChange={(event) => setManualDay(event.target.value)}
                    style={{ marginLeft: ".35rem", width: 76 }}
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
            {filterStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="admin-copy" style={{ marginTop: ".75rem" }}>Loading Yeardle candidates...</p> : null}
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
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: ".65rem", alignItems: "start" }}>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={`${item.title} historical image`}
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
                  No image
                </div>
              )}
              <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: "1rem" }}>{item.title}</p>
            <p style={{ margin: ".18rem 0", color: "#5b6168", fontSize: ".88rem" }}>
              Date: {formatEventDate(item.event_month, item.event_day, item.event_year)} | Status: {item.status}
            </p>
            {getScheduleWarningCopy(item) ? (
              <p style={{ margin: "0 0 .18rem", color: "#8b2d2d", fontSize: ".86rem", fontWeight: 800 }}>
                {getScheduleWarningCopy(item)}
              </p>
            ) : null}
            <p style={{ margin: 0, color: "#5b6168", fontSize: ".88rem" }}>
              Usage: {item.scheduleCount === 0 ? "Not used yet" : `${item.scheduleCount}x (last ${item.lastScheduledDate})`}
            </p>
            {item.nextScheduledDate ? (
              <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                Scheduled: <b>{item.nextScheduledDate}</b>
              </p>
            ) : null}
            <p style={{ margin: ".2rem 0 0", color: item.image_license_verified_at ? "#2f672d" : "#8b2d2d", fontSize: ".82rem", fontWeight: 800 }}>
              Image attribution: {item.image_license_verified_at ? "verified" : "needs review"}
              {item.image_license ? ` | ${item.image_license}` : ""}
            </p>

            {editingCandidateId === item.id && editingCandidateDraft ? (
              <div style={{ marginTop: ".5rem", display: "grid", gap: ".4rem", maxWidth: 760 }}>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Title
                  <input
                    type="text"
                    value={editingCandidateDraft.title}
                    onChange={(event) => updateEditingCandidateField("title", event.target.value)}
                    style={{ marginLeft: ".35rem", minWidth: 280 }}
                  />
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event year
                  <input
                    type="number"
                    min="1000"
                    max={new Date().getFullYear()}
                    value={editingCandidateDraft.eventYear}
                    onChange={(event) => updateEditingCandidateField("eventYear", event.target.value)}
                    style={{ marginLeft: ".35rem", width: 120 }}
                  />
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event month
                  <select
                    value={editingCandidateDraft.eventMonth}
                    onChange={(event) => updateEditingCandidateField("eventMonth", event.target.value)}
                    style={{ marginLeft: ".35rem" }}
                  >
                    {monthOptions.map(([value, label]) => (
                      <option key={value || "empty"} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Event day
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={editingCandidateDraft.eventDay}
                    onChange={(event) => updateEditingCandidateField("eventDay", event.target.value)}
                    style={{ marginLeft: ".35rem", width: 76 }}
                  />
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Wikipedia URL
                  <input
                    type="text"
                    value={editingCandidateDraft.wikipediaUrl}
                    onChange={(event) => updateEditingCandidateField("wikipediaUrl", event.target.value)}
                    style={{ marginLeft: ".35rem", minWidth: 320 }}
                  />
                </label>
                <label style={{ fontWeight: 700, fontSize: ".85rem" }}>
                  Description
                  <textarea
                    rows={4}
                    value={editingCandidateDraft.description}
                    onChange={(event) => updateEditingCandidateField("description", event.target.value)}
                    style={{ display: "block", marginTop: ".25rem", width: "100%", maxWidth: 720 }}
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
              <button className="admin-btn" type="button" onClick={() => beginEditCandidate(item)}>
                Edit candidate
              </button>
              <button className="admin-btn" type="button" onClick={() => openPhotoPreview(item)}>
                Manage photo
              </button>
              <button className="admin-btn" type="button" onClick={() => void deleteCandidate(item.id)}>Delete</button>
            </div>
              </div>
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

      {photoPreviewCandidate ? (
        <div
          onClick={closePhotoPreview}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 130,
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
                <p style={{ margin: 0, fontWeight: 900 }}>{photoPreviewCandidate.title}</p>
                <p style={{ margin: ".2rem 0 0", color: "#5b6168", fontSize: ".88rem" }}>
                  Year: {photoPreviewCandidate.event_year} | Status: {photoPreviewCandidate.status}
                </p>
              </div>
              <button className="admin-btn" type="button" onClick={closePhotoPreview}>Close</button>
            </div>

            <div style={{ marginTop: ".75rem", border: "1px solid #d8dce2", borderRadius: 14, padding: ".55rem", background: "#f8fafc" }}>
              {photoPreviewCandidate.image_url ? (
                <img
                  src={photoPreviewCandidate.image_url}
                  alt={`${photoPreviewCandidate.title} historical image`}
                  style={{ width: "100%", maxHeight: 420, objectFit: "contain", borderRadius: 10, background: "#fff" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 240,
                    borderRadius: 10,
                    border: "1px dashed #c4c9d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6c727a",
                    background: "#fff",
                    fontWeight: 700,
                  }}
                >
                  No image
                </div>
              )}
            </div>

            <div style={{ marginTop: ".75rem", display: "grid", gap: ".5rem" }}>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Wikimedia Commons URL
                <input
                  value={photoCommonsUrl}
                  onChange={(event) => setPhotoCommonsUrl(event.target.value)}
                  placeholder="https://commons.wikimedia.org/wiki/File:..."
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                />
              </label>
              <button
                className="admin-btn"
                type="button"
                onClick={() => void lookupPhotoCommonsImage()}
                disabled={isLookingUpPhotoImage}
                style={{ justifySelf: "start" }}
              >
                {isLookingUpPhotoImage ? "Looking up..." : "Use Wikimedia image + attribution"}
              </button>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Image URL (hotlink)
                <input
                  value={photoDraftUrl}
                  onChange={(event) => setPhotoDraftUrl(event.target.value)}
                  placeholder="https://..."
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Image alt text
                <input
                  value={photoDraftAlt}
                  onChange={(event) => setPhotoDraftAlt(event.target.value)}
                  placeholder={`${photoPreviewCandidate.title} historical image`}
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: ".5rem" }}>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  Source page URL
                  <input
                    value={photoDraftSourcePageUrl}
                    onChange={(event) => {
                      setPhotoDraftSourcePageUrl(event.target.value);
                      setPhotoDraftLicenseVerified(false);
                    }}
                    placeholder="https://commons.wikimedia.org/wiki/File:..."
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  License
                  <input
                    value={photoDraftLicense}
                    onChange={(event) => {
                      setPhotoDraftLicense(event.target.value);
                      setPhotoDraftLicenseVerified(false);
                    }}
                    placeholder="CC BY-SA 4.0"
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  License URL
                  <input
                    value={photoDraftLicenseUrl}
                    onChange={(event) => {
                      setPhotoDraftLicenseUrl(event.target.value);
                      setPhotoDraftLicenseVerified(false);
                    }}
                    placeholder="https://creativecommons.org/..."
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
                <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                  Author
                  <input
                    value={photoDraftAuthor}
                    onChange={(event) => {
                      setPhotoDraftAuthor(event.target.value);
                      setPhotoDraftLicenseVerified(false);
                    }}
                    placeholder="Photographer / creator"
                    style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                  />
                </label>
              </div>
              <label style={{ display: "grid", gap: ".28rem", fontWeight: 700 }}>
                Attribution text
                <input
                  value={photoDraftAttributionText}
                  onChange={(event) => {
                    setPhotoDraftAttributionText(event.target.value);
                    setPhotoDraftLicenseVerified(false);
                  }}
                  placeholder="Image title | Author | License"
                  style={{ border: "1px solid #d8dce2", borderRadius: 10, padding: ".52rem .6rem" }}
                />
              </label>
              <label style={{ display: "flex", gap: ".45rem", alignItems: "center", fontWeight: 800, color: "#2f672d" }}>
                <input
                  type="checkbox"
                  checked={photoDraftLicenseVerified}
                  onChange={(event) => setPhotoDraftLicenseVerified(event.target.checked)}
                />
                Image source, author, license, and attribution verified
              </label>
              <div style={{ display: "flex", gap: ".45rem", alignItems: "center", flexWrap: "wrap" }}>
                <label className="admin-btn" style={{ cursor: uploadingPhotoCandidateId ? "default" : "pointer", opacity: uploadingPhotoCandidateId ? 0.65 : 1 }}>
                  {uploadingPhotoCandidateId === photoPreviewCandidate.id ? "Uploading..." : "Upload JPG/PNG"}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    style={{ display: "none" }}
                    disabled={Boolean(uploadingPhotoCandidateId)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void uploadPreviewPhoto(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  className="admin-btn primary"
                  type="button"
                  onClick={() => void savePreviewPhoto()}
                  disabled={savingPhotoCandidateId === photoPreviewCandidate.id}
                >
                  {savingPhotoCandidateId === photoPreviewCandidate.id ? "Saving..." : "Save photo"}
                </button>
                <button
                  className="admin-btn"
                  type="button"
                  onClick={() => void deletePreviewPhoto()}
                  disabled={deletingPhotoCandidateId === photoPreviewCandidate.id || !photoPreviewCandidate.image_url}
                >
                  {deletingPhotoCandidateId === photoPreviewCandidate.id ? "Deleting..." : "Delete current image"}
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem" }}>
              {photoPreviewCandidate.wikipedia_url ? (
                <a className="admin-btn" href={photoPreviewCandidate.wikipedia_url} target="_blank" rel="noreferrer">
                  Wikipedia
                </a>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
