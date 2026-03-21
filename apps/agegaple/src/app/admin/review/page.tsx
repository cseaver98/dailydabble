"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CandidateStatus, QueueHealth, ReviewCandidate } from "@/lib/types";

type CandidatesResponse = {
  items: ReviewCandidate[];
  queueHealth: QueueHealth;
};

const statuses: CandidateStatus[] = ["pending_review", "approved", "rejected"];
const batchSizeOptions = [1, 5, 10, 15, 20] as const;

export default function ReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewCandidate[]>([]);
  const [queueHealth, setQueueHealth] = useState<QueueHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedOutput, setSeedOutput] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [batchSize, setBatchSize] = useState<(typeof batchSizeOptions)[number]>(5);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "all">("pending_review");
  const [galleryCandidateId, setGalleryCandidateId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [removeImageError, setRemoveImageError] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageTitle, setNewImageTitle] = useState("");
  const [newImageAttribution, setNewImageAttribution] = useState("");
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [addImageError, setAddImageError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/admin/candidates");
      if (!response.ok) {
        throw new Error("Failed to load candidates");
      }
      const data = (await response.json()) as CandidatesResponse;
      setItems(data.items);
      setQueueHealth(data.queueHealth);
    } catch {
      setError("Could not load review candidates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending_review").length,
    [items],
  );

  const approvedCount = useMemo(
    () => items.filter((item) => item.status === "approved").length,
    [items],
  );

  const visibleItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.qualityScore - a.qualityScore);
    if (statusFilter === "all") {
      return sorted;
    }
    return sorted.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const patchStatus = async (id: string, status: CandidateStatus) => {
    setError(null);
    const response = await fetch("/api/admin/candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Failed to update status");
      return;
    }

    await load();
  };

  const runSeed = async () => {
    setSeedError(null);
    setSeedOutput(null);
    setIsSeeding(true);

    try {
      const response = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize }),
      });
      const payload = (await response.json()) as { error?: string; details?: string; output?: string };

      if (!response.ok) {
        setSeedError(payload.details ?? payload.error ?? "Seed failed");
        return;
      }

      setSeedOutput(payload.output ?? "Seed finished.");
      await load();
    } catch {
      setSeedError("Could not start batch seed.");
    } finally {
      setIsSeeding(false);
    }
  };

  const galleryCandidate = useMemo(
    () => items.find((item) => item.id === galleryCandidateId) ?? null,
    [items, galleryCandidateId],
  );
  const galleryImages = galleryCandidate?.galleryImages ?? [];
  const activeGalleryImage = galleryImages[galleryIndex] ?? galleryImages[0];
  const canNavigateGallery = galleryImages.length > 1;

  const openGallery = (candidateId: string) => {
    setGalleryCandidateId(candidateId);
    setGalleryIndex(0);
    setRemoveImageError(null);
    setAddImageError(null);
  };

  const removeActiveImage = async () => {
    if (!activeGalleryImage || activeGalleryImage.id.startsWith("fallback-")) {
      return;
    }

    setRemoveImageError(null);
    setIsRemovingImage(true);

    try {
      const response = await fetch("/api/admin/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: activeGalleryImage.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setRemoveImageError(payload.error ?? "Failed to remove image");
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

    setAddImageError(null);
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

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setAddImageError(payload.error ?? "Failed to add image");
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="mb-6 space-y-2">
          <p>
            <Link href="/" className="text-xl font-bold text-slate-900 hover:underline">
              Agegaple
            </Link>
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.15em] text-slate-600">Admin</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
          <h1 className="text-3xl font-semibold">Candidate Review</h1>
          <p className="text-slate-700">Pending: {pendingCount} | Approved: {approvedCount}</p>
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <label className="text-sm text-slate-700">
              Batch size
              <select
                className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1"
                value={batchSize}
                onChange={(event) => setBatchSize(Number(event.target.value) as (typeof batchSizeOptions)[number])}
                disabled={isSeeding}
              >
                {batchSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void runSeed()}
              disabled={isSeeding}
              className="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSeeding ? "Seeding..." : `Start Batch Seed (${batchSize})`}
            </button>
          </div>
          {seedError && (
            <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">{seedError}</p>
          )}
          {seedOutput && (
            <pre className="max-h-56 overflow-auto rounded-md border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
              {seedOutput}
            </pre>
          )}
        </header>

        {queueHealth && (
          <section
            className={`mb-6 rounded-xl border p-4 ${
              queueHealth.isLow
                ? "border-amber-300 bg-amber-50"
                : "border-emerald-300 bg-emerald-50"
            }`}
          >
            <h2 className="text-lg font-semibold">Queue Health</h2>
            <p className="text-sm text-slate-700">
              Runway: <span className="font-semibold">{queueHealth.runwayDays} day(s)</span> |
              Approved unused: <span className="font-semibold">{queueHealth.approvedUnused}</span> |
              Approved used: <span className="font-semibold">{queueHealth.approvedUsed}</span> |
              Pending: <span className="font-semibold">{queueHealth.pending}</span> |
              Rejected: <span className="font-semibold">{queueHealth.rejected}</span>
            </p>
            {queueHealth.isLow && (
              <p className="mt-1 text-sm font-medium text-amber-700">
                Low queue warning: below threshold of {queueHealth.lowQueueThreshold}. Seed and review more candidates.
              </p>
            )}
          </section>
        )}

        <div className="mb-4">
          <label className="text-sm text-slate-700">
            Status Filter
            <select
              className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CandidateStatus | "all")}
            >
              <option value="all">all</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p>Loading candidates...</p>}
        {error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</p>}

        <div className="grid gap-4">
          {visibleItems.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-300 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <Image
                  src={item.imageUrl}
                  alt={item.couple}
                  className="h-36 w-full cursor-zoom-in rounded-md object-cover"
                  width={640}
                  height={360}
                  unoptimized
                  onClick={() => openGallery(item.id)}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{item.couple}</h2>
                    {item.isUpNext && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Up Next (Tomorrow)
                      </span>
                    )}
                    {item.isUsedToday && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Used Today
                      </span>
                    )}
                    {item.usedCount > 0 && !item.isUsedToday && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        Used
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">Relationship: {item.relationshipType}</p>
                  <p className="text-sm text-slate-700">
                    Gap: {item.roundedAgeGapYears} years (exact {item.exactAgeGapYears})
                  </p>
                  <p className="text-sm text-slate-700">
                    Birth dates: {item.personABirthDate} and {item.personBBirthDate}
                  </p>
                  <p className="text-sm text-slate-700">Score: {item.qualityScore}</p>
                  <p className="text-sm text-slate-700">Status: {item.status}</p>
                  <p className="text-sm text-slate-700">
                    Puzzle usage:{" "}
                    {item.usedCount === 0
                      ? "Not used yet"
                      : `${item.usedCount} time(s), last ${item.lastUsedPuzzleDate}`}
                  </p>
                  <p className="text-sm text-slate-700">Usable photos: {item.galleryImages.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500"
                  onClick={() => patchStatus(item.id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500"
                  onClick={() => patchStatus(item.id, "rejected")}
                >
                  Reject
                </button>
                <button
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-slate-900 hover:bg-amber-400"
                  onClick={() => patchStatus(item.id, "pending_review")}
                >
                  Mark Pending
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {galleryCandidate && activeGalleryImage && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-4"
          onClick={() => setGalleryCandidateId(null)}
        >
          <div className="relative my-4 w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            {canNavigateGallery && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setGalleryIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length)
                  }
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-500 bg-zinc-900/90 px-3 py-2 text-lg font-bold text-zinc-100 hover:bg-zinc-800"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryIndex((current) => (current + 1) % galleryImages.length)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-500 bg-zinc-900/90 px-3 py-2 text-lg font-bold text-zinc-100 hover:bg-zinc-800"
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void removeActiveImage()}
                disabled={isRemovingImage || activeGalleryImage.id.startsWith("fallback-")}
                className="rounded-md border border-rose-500 bg-rose-700/90 px-2 py-1 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRemovingImage ? "Removing..." : "Remove This Photo"}
              </button>
              <button
                type="button"
                onClick={() => setGalleryCandidateId(null)}
                className="rounded-md border border-zinc-500 bg-zinc-900/90 px-2 py-1 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950" style={{ aspectRatio: "4 / 3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="h-full w-full object-contain object-top"
                src={activeGalleryImage.imageUrl}
                alt={activeGalleryImage.imageAlt}
              />
            </div>
            {galleryImages.length > 1 && (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {galleryImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setGalleryIndex(index)}
                    className={`overflow-hidden rounded border ${
                      index === galleryIndex ? "border-emerald-400 ring-2 ring-emerald-300/40" : "border-zinc-600"
                    }`}
                    style={{ aspectRatio: "4 / 3" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt={image.imageAlt} className="h-full w-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900/80 p-3">
              <p className="mb-2 text-sm font-semibold text-zinc-100">Add Image URL</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={newImageUrl}
                  onChange={(event) => setNewImageUrl(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-emerald-500 sm:col-span-2"
                />
                <input
                  value={newImageTitle}
                  onChange={(event) => setNewImageTitle(event.target.value)}
                  placeholder="Optional title"
                  className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
                <input
                  value={newImageAttribution}
                  onChange={(event) => setNewImageAttribution(event.target.value)}
                  placeholder="Optional attribution"
                  className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => void addImageToGallery()}
                disabled={isAddingImage}
                className="mt-2 rounded-md border border-emerald-500 bg-emerald-700/90 px-2 py-1 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAddingImage ? "Adding..." : "Add Photo"}
              </button>
              {addImageError && <p className="mt-2 text-sm text-rose-300">{addImageError}</p>}
            </div>
            {removeImageError && <p className="mt-2 text-center text-sm text-rose-300">{removeImageError}</p>}
            <p className="mt-2 text-center text-sm text-zinc-300">
              {galleryCandidate.couple} • Photo {Math.min(galleryIndex + 1, galleryImages.length)} of{" "}
              {galleryImages.length}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
