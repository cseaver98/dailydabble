"use client";

import { FormEvent, useState } from "react";

type ProfileFormProps = {
  initialDisplayName: string;
};

export default function ProfileForm({ initialDisplayName }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const hasChanges = displayName.trim() !== savedDisplayName.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || saving) return;

    setSaving(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not update display name.");
      }

      const nextDisplayName = typeof payload.profile?.displayName === "string" ? payload.profile.displayName : displayName.trim();
      setDisplayName(nextDisplayName);
      setSavedDisplayName(nextDisplayName);
      setStatus("Display name saved.");
      window.dispatchEvent(new Event("dailydabble:profile-updated"));
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not update display name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="rounded-2xl bg-[#f5f6f9] px-4 py-4" onSubmit={handleSubmit}>
      <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]" htmlFor="displayName">
        Display name
      </label>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setStatus("");
            setError("");
          }}
          minLength={2}
          maxLength={32}
          className="h-12 rounded-full border border-[#d8dce2] bg-white px-4 text-base font-bold text-[#2c2f31] outline-none transition focus:border-[#2f672d] focus:ring-4 focus:ring-[#b6f6ab]/45"
        />
        <button
          type="submit"
          disabled={!hasChanges || saving}
          className="font-headline h-12 rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-not-allowed disabled:bg-[#abadb0] disabled:text-white"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-[#75777a]">2-32 characters. This is what you will see in your account menu.</p>
      {status ? <p className="mt-3 text-sm font-bold text-[#2f672d]">{status}</p> : null}
      {error ? <p className="mt-3 text-sm font-bold text-[#b02500]">{error}</p> : null}
    </form>
  );
}
