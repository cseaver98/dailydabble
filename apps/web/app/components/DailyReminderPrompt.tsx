"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DISMISSED_KEY_PREFIX = "dailydabble:v1:daily-reminder-prompt-dismissed";

type ReminderPromptEvent = CustomEvent<{ puzzleDate?: string }>;

export default function DailyReminderPrompt() {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [puzzleDate, setPuzzleDate] = useState<string | null>(null);
  const [pendingPuzzleDate, setPendingPuzzleDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setPortalRoot(document.body), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      const promptEvent = event as ReminderPromptEvent;
      const date = promptEvent.detail?.puzzleDate;
      if (!date) return;

      const dismissedKey = `${DISMISSED_KEY_PREFIX}:${date}`;
      if (window.localStorage.getItem(dismissedKey)) {
        return;
      }

      setError("");
      setPendingPuzzleDate(date);
    };

    window.addEventListener("dailydabble:daily-reminder-prompt", handlePrompt);
    return () => window.removeEventListener("dailydabble:daily-reminder-prompt", handlePrompt);
  }, []);

  useEffect(() => {
    if (!pendingPuzzleDate || puzzleDate) return;

    const showPendingPrompt = () => {
      window.setTimeout(() => {
        setPuzzleDate(pendingPuzzleDate);
        setPendingPuzzleDate(null);
      }, 0);
    };

    window.addEventListener("pointerup", showPendingPrompt, { once: true, capture: true });
    window.addEventListener("keydown", showPendingPrompt, { once: true, capture: true });

    return () => {
      window.removeEventListener("pointerup", showPendingPrompt, { capture: true });
      window.removeEventListener("keydown", showPendingPrompt, { capture: true });
    };
  }, [pendingPuzzleDate, puzzleDate]);

  useEffect(() => {
    if (!puzzleDate) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [puzzleDate]);

  const dismiss = () => {
    if (puzzleDate) {
      window.localStorage.setItem(`${DISMISSED_KEY_PREFIX}:${puzzleDate}`, new Date().toISOString());
    }
    setPuzzleDate(null);
    setSaving(false);
    setError("");
  };

  const markPrompted = async () => {
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markDailyReminderPrompted: true }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(typeof payload.error === "string" ? payload.error : "Could not update reminder prompt.");
    }
  };

  const closeWithoutSaving = () => {
    setPuzzleDate(null);
    setSaving(false);
    setError("");
  };

  const dismissAndMarkPrompted = async () => {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await markPrompted();
      dismiss();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update reminder prompt.");
      setSaving(false);
    }
  };

  const accept = async () => {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyReminderOptIn: true, markDailyReminderPrompted: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not enable reminders.");
      }

      window.dispatchEvent(new Event("dailydabble:profile-updated"));
      dismiss();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not enable reminders.");
      setSaving(false);
    }
  };

  if (!portalRoot || !puzzleDate) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2c2f31]/45 px-4 backdrop-blur-sm"
      onClick={closeWithoutSaving}
    >
      <section
        className="relative w-full max-w-md rounded-[2rem] border border-[#d8dce2] bg-white p-6 shadow-[0_28px_80px_rgba(44,47,49,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reminder-prompt-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeWithoutSaving}
          aria-label="Close reminder prompt"
          className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#eff1f4] text-lg font-bold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
        >
          ×
        </button>
        <h2 id="daily-reminder-prompt-title" className="font-headline text-3xl font-extrabold leading-tight text-[#2c2f31]">
          Nice work, you finished today&apos;s games.
        </h2>
        <p className="mt-3 text-base font-semibold leading-relaxed text-[#595c5e]">
          Want a reminder when tomorrow&apos;s games are live? It&apos;s an easy way to keep your DailyDabble streak 🔥 going.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void accept()}
            disabled={saving}
            className="font-headline h-12 cursor-pointer rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving..." : "Yes, remind me"}
          </button>
          <button
            type="button"
            onClick={() => void dismissAndMarkPrompted()}
            disabled={saving}
            className="font-headline h-12 cursor-pointer rounded-full bg-[#eff1f4] px-5 text-sm font-extrabold text-[#2c2f31] transition hover:bg-[#e0e3e6] disabled:cursor-wait disabled:opacity-70"
          >
            Not now
          </button>
        </div>
        {error ? <p className="mt-4 text-sm font-bold text-[#b02500]">{error}</p> : null}
      </section>
    </div>,
    portalRoot,
  );
}
