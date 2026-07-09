"use client";

import { FormEvent, useState } from "react";
import DailyDabbleWordmark from "./DailyDabbleWordmark";

type ArchiveLockGateProps = {
  archiveHref: string;
  backLabel?: string;
  description?: string;
  mode?: "password" | "subscription";
  title?: string;
};

export default function ArchiveLockGate({
  archiveHref,
  backLabel = "Back to archive",
  description = "",
  mode = "password",
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
      {mode === "password" ? <h1 className="page-title">{title}</h1> : null}
      {mode === "subscription" ? (
        <div className="mx-auto max-w-xl px-2 text-center">
          <p className="font-headline text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#2f672d]">Coming soon</p>
          <p className="mt-2 font-headline text-xl font-black leading-tight text-[#2c2f31]">
            Archive games are becoming part of <DailyDabbleWordmark plus className="text-[1em]" />
          </p>
          <p className="mx-auto mt-3 max-w-md text-left text-sm font-semibold leading-relaxed text-[#595c5e]">
            We&apos;re getting subscriber access ready. For now, head back to today&apos;s games and keep the streak warm.
          </p>
        </div>
      ) : description ? (
        <p className="page-subtle">{description}</p>
      ) : null}
      {mode === "password" ? (
        <>
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
        </>
      ) : null}
      <div className={mode === "subscription" ? "mt-5 flex justify-center" : "mt-5"}>
        <a
          className={mode === "subscription"
            ? "font-headline inline-flex h-12 items-center justify-center rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
            : "page-subtle underline decoration-black/20 underline-offset-4"}
          href={archiveHref}
        >
          {backLabel}
        </a>
      </div>
    </section>
  );
}
