"use client";

import { FormEvent, useState } from "react";

type ArchiveLockGateProps = {
  archiveHref: string;
  description?: string;
  title?: string;
};

export default function ArchiveLockGate({
  archiveHref,
  description = "Enter the shared password to open this retired archive game.",
  title = "Archive Game #1 is locked",
}: ArchiveLockGateProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/archive/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not unlock archive game.");
      }

      window.location.reload();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Could not unlock archive game.");
      setSubmitting(false);
    }
  };

  return (
    <section className="card legal-card archive-card">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtle">{description}</p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm font-medium text-[#2c2f31] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
        <button className="admin-btn-like" type="submit" disabled={submitting}>
          {submitting ? "Unlocking..." : "Unlock"}
        </button>
      </form>
      {error ? <p className="page-subtle error-text mt-3">{error}</p> : null}
      <div className="mt-5">
        <a className="page-subtle underline decoration-black/20 underline-offset-4" href={archiveHref}>
          Back to archive
        </a>
      </div>
    </section>
  );
}
