"use client";

import { useState } from "react";
import DailyDabbleWordmark from "../components/DailyDabbleWordmark";

type EmailPreferencesFormProps = {
  initialMarketingEmailOptIn: boolean;
  initialDailyReminderOptIn: boolean;
};

export default function EmailPreferencesForm({
  initialMarketingEmailOptIn,
  initialDailyReminderOptIn,
}: EmailPreferencesFormProps) {
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(initialMarketingEmailOptIn);
  const [dailyReminderOptIn, setDailyReminderOptIn] = useState(initialDailyReminderOptIn);
  const [savedMarketingEmailOptIn, setSavedMarketingEmailOptIn] = useState(initialMarketingEmailOptIn);
  const [savedDailyReminderOptIn, setSavedDailyReminderOptIn] = useState(initialDailyReminderOptIn);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const hasChanges =
    marketingEmailOptIn !== savedMarketingEmailOptIn || dailyReminderOptIn !== savedDailyReminderOptIn;

  const savePreferences = async () => {
    if (!hasChanges || saving) return;

    setSaving(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingEmailOptIn, dailyReminderOptIn }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not update email preferences.");
      }

      setSavedMarketingEmailOptIn(Boolean(payload.profile?.marketingEmailOptIn));
      setSavedDailyReminderOptIn(Boolean(payload.profile?.dailyReminderOptIn));
      setStatus("Email preferences saved.");
      window.dispatchEvent(new Event("dailydabble:profile-updated"));
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : "Could not update email preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="email-preferences" className="scroll-mt-24 rounded-2xl bg-[#f5f6f9] px-4 py-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Email preferences</p>
      <div className="mt-4 grid gap-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={marketingEmailOptIn}
            onChange={(event) => {
              setMarketingEmailOptIn(event.target.checked);
              setStatus("");
              setError("");
            }}
            className="mt-1 h-4 w-4 cursor-pointer accent-[#2f672d]"
          />
          <span>
            <span className="block text-sm font-extrabold text-[#2c2f31]">Product updates and launch news</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed text-[#666a6d]">
              Occasional <DailyDabbleWordmark className="text-[1em]" /> news, feature updates, and product announcements.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={dailyReminderOptIn}
            onChange={(event) => {
              setDailyReminderOptIn(event.target.checked);
              setStatus("");
              setError("");
            }}
            className="mt-1 h-4 w-4 cursor-pointer accent-[#2f672d]"
          />
          <span>
            <span className="block text-sm font-extrabold text-[#2c2f31]">Daily Verble reminders</span>
            <span className="mt-1 block text-sm font-semibold leading-relaxed text-[#666a6d]">
              A simple reminder when today&apos;s Verble is live, only if you have not played yet.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={() => void savePreferences()}
          className="font-headline h-12 w-full rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-not-allowed disabled:bg-[#abadb0] disabled:text-white sm:w-auto"
        >
          {saving ? "Saving..." : "Save email preferences"}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm font-bold text-[#2f672d]">{status}</p> : null}
      {error ? <p className="mt-3 text-sm font-bold text-[#b02500]">{error}</p> : null}
    </section>
  );
}
