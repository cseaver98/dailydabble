"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { trackEvent, trackEventOnce } from "@/lib/analytics-client";
import { games } from "@/lib/games";
import DailyDabbleWordmark from "./DailyDabbleWordmark";
import DailyTrophyIcon from "./DailyTrophyIcon";

const SHOWN_KEY_PREFIX = "dailydabble:v1:trophy-dialog-shown";
const REMINDER_DISMISSED_KEY_PREFIX = "dailydabble:v1:daily-reminder-prompt-dismissed";

type CompletionEvent = CustomEvent<{
  puzzleDate?: string;
}>;

type CompletionStatusResponse = {
  status?: Record<string, boolean>;
  ownerKey?: string | null;
};

type ReminderPromptEvent = CustomEvent<{
  puzzleDate?: string;
}>;

const formatTrophyDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

export default function TrophyEarnedDialog() {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [trophyDate, setTrophyDate] = useState<string | null>(null);
  const [completionOwnerKey, setCompletionOwnerKey] = useState<string | null>(null);
  const [reminderPuzzleDate, setReminderPuzzleDate] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setPortalRoot(document.body), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleReminderPrompt = (event: Event) => {
      const puzzleDate = (event as ReminderPromptEvent).detail?.puzzleDate;
      if (!puzzleDate) return;

      setReminderError("");
      setReminderPuzzleDate(puzzleDate);
    };

    window.addEventListener("dailydabble:daily-reminder-prompt", handleReminderPrompt);
    return () => window.removeEventListener("dailydabble:daily-reminder-prompt", handleReminderPrompt);
  }, []);

  useEffect(() => {
    let showTimeoutId: number | null = null;
    const pendingDates = new Set<string>();

    const handleCompletion = async (event: Event) => {
      const puzzleDate = (event as CompletionEvent).detail?.puzzleDate;
      if (!puzzleDate) return;

      try {
        if (pendingDates.has(puzzleDate)) return;

        const response = await fetch("/api/completions/today", { cache: "no-store" });
        const payload = (await response.json()) as CompletionStatusResponse;
        if (!response.ok) return;

        const ownerKey = payload.ownerKey;
        if (!ownerKey) return;

        const shownKey = `${SHOWN_KEY_PREFIX}:${ownerKey}:${puzzleDate}`;
        if (window.localStorage.getItem(shownKey)) return;

        const completedCount = games.filter((game) => payload.status?.[game.slug]).length;
        if (completedCount !== games.length) return;

        pendingDates.add(puzzleDate);
        showTimeoutId = window.setTimeout(() => {
          try {
            window.localStorage.setItem(shownKey, new Date().toISOString());
          } catch {
            // The celebration can still display when storage is unavailable.
          }
          pendingDates.delete(puzzleDate);
          setCompletionOwnerKey(ownerKey);
          setTrophyDate(puzzleDate);
        }, 650);
      } catch {
        // Trophy celebration must never interrupt completion persistence.
      }
    };

    window.addEventListener("dailydabble:today-completion-recorded", handleCompletion);
    return () => {
      window.removeEventListener("dailydabble:today-completion-recorded", handleCompletion);
      if (showTimeoutId !== null) window.clearTimeout(showTimeoutId);
    };
  }, []);

  useEffect(() => {
    if (!trophyDate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [trophyDate]);

  const reminderDismissedKey = trophyDate && completionOwnerKey
    ? `${REMINDER_DISMISSED_KEY_PREFIX}:${completionOwnerKey}:${trophyDate}`
    : null;
  let reminderWasDismissed = false;
  if (reminderDismissedKey) {
    try {
      reminderWasDismissed = Boolean(window.localStorage.getItem(reminderDismissedKey));
    } catch {
      // Reminder eligibility can still be shown when storage is unavailable.
    }
  }
  const showReminder = Boolean(
    trophyDate && reminderPuzzleDate === trophyDate && !reminderWasDismissed,
  );

  useEffect(() => {
    if (!showReminder || !trophyDate) return;
    trackEventOnce(`reminder-prompt:${trophyDate}`, {
      eventName: "reminder_prompt_shown",
      puzzleDate: trophyDate,
    });
  }, [showReminder, trophyDate]);

  if (!portalRoot || !trophyDate) return null;

  const close = () => {
    setTrophyDate(null);
    setCompletionOwnerKey(null);
    setReminderPuzzleDate(null);
    setSavingReminder(false);
    setReminderError("");
  };

  const markReminderPrompted = async () => {
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

  const markReminderDismissed = () => {
    if (!reminderDismissedKey) return;
    try {
      window.localStorage.setItem(reminderDismissedKey, new Date().toISOString());
    } catch {
      // Profile state still prevents repeated prompts when storage is unavailable.
    }
  };

  const dismissReminder = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    setReminderError("");
    try {
      await markReminderPrompted();
      markReminderDismissed();
      close();
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Could not update reminder prompt.");
      setSavingReminder(false);
    }
  };

  const enableReminder = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    setReminderError("");
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
      trackEvent({ eventName: "reminder_enabled", puzzleDate: trophyDate });
      markReminderDismissed();
      close();
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Could not enable reminders.");
      setSavingReminder(false);
    }
  };

  return createPortal(
    <div className="daily-trophy-dialog-backdrop fixed inset-0 z-[140] flex items-center justify-center bg-[#2c2f31]/55 px-4 backdrop-blur-sm" onClick={close}>
      <section
        className="daily-trophy-dialog-card relative w-full max-w-md overflow-hidden rounded-[2.25rem] border border-[#ecd377] bg-[linear-gradient(155deg,#fffef8_0%,#fff6d1_100%)] p-7 text-center shadow-[0_32px_100px_rgba(53,38,8,0.3)] sm:p-9"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-trophy-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close trophy celebration"
          className="result-modal-close"
        >
          ×
        </button>

        <div className="daily-trophy-confetti pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => <span key={index} />)}
        </div>
        <div className="daily-trophy-dialog-burst absolute left-1/2 top-20 h-40 w-40 -translate-x-1/2 rounded-full bg-[#f4c84b]/25 blur-2xl" />
        <div className="daily-trophy-dialog-icon relative mx-auto w-fit">
          <DailyTrophyIcon className="h-32 w-32" />
        </div>
        <div className="daily-trophy-dialog-plaque relative mx-auto -mt-3 w-fit rounded-lg border border-[#7d5108] bg-[linear-gradient(180deg,#dda62d,#b97708)] px-5 py-2 shadow-[inset_0_1px_rgba(255,255,255,0.5)]">
          <p className="font-headline whitespace-nowrap text-xs font-extrabold text-white">{formatTrophyDate(trophyDate)}</p>
        </div>

        <h2 id="daily-trophy-dialog-title" className="font-headline mt-6 text-4xl font-extrabold leading-tight text-[#2c2f31]">
          Amazing job!
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-base font-semibold leading-relaxed text-[#665a42]">
          You finished all 7 games and earned today&apos;s trophy.
        </p>

        {showReminder ? (
          <div className="mt-6 border-t border-[#dfc875] pt-5">
            <p className="text-sm font-semibold leading-relaxed text-[#665a42]">
              Want a reminder when tomorrow&apos;s games are live? It&apos;s an easy way to keep your <DailyDabbleWordmark className="text-[1em]" /> streak 🔥 going.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void dismissReminder()}
                disabled={savingReminder}
                className="font-headline h-12 cursor-pointer rounded-full bg-white px-5 text-sm font-extrabold text-[#51370a] shadow-[0_8px_20px_rgba(81,55,10,0.08)] transition hover:bg-[#fffdf5] disabled:cursor-wait disabled:opacity-70"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void enableReminder()}
                disabled={savingReminder}
                className="font-headline h-12 cursor-pointer rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] shadow-[0_10px_24px_rgba(47,103,45,0.2)] transition hover:bg-[#225b22] disabled:cursor-wait disabled:opacity-70"
              >
                {savingReminder ? "Saving..." : "Yes, remind me"}
              </button>
            </div>
            <Link href="/account/stats#trophy-case" onClick={close} className="font-headline mt-4 inline-block text-sm font-extrabold text-[#7d5108] underline decoration-2 underline-offset-4">
              View Trophy Case
            </Link>
            {reminderError ? <p className="mt-3 text-sm font-bold text-[#b02500]">{reminderError}</p> : null}
          </div>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={close}
              className="font-headline h-12 cursor-pointer rounded-full bg-white px-5 text-sm font-extrabold text-[#51370a] shadow-[0_8px_20px_rgba(81,55,10,0.08)] transition hover:bg-[#fffdf5]"
            >
              Close
            </button>
            <Link
              href="/account/stats#trophy-case"
              onClick={close}
              className="font-headline inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d99e22,#a96d05)] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(169,109,5,0.25)] transition hover:brightness-95"
            >
              View Trophy Case
            </Link>
          </div>
        )}
      </section>
    </div>,
    portalRoot,
  );
}
