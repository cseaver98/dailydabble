"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DisplayNameDialogProps = {
  isOpen: boolean;
  onComplete: () => void;
};

export default function DisplayNameDialog({ isOpen, onComplete }: DisplayNameDialogProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPortalRoot(document.body);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not save display name.");
      }

      window.dispatchEvent(new Event("dailydabble:profile-updated"));
      onComplete();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save display name.");
    } finally {
      setSaving(false);
    }
  };

  if (!portalRoot || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2c2f31]/45 px-4 backdrop-blur-sm">
      <section
        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d8dce2] bg-white p-6 shadow-[0_28px_80px_rgba(44,47,49,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-dialog-title"
      >
        <div className="relative">
          <p className="dd-brand-word mb-4 inline-block !text-2xl">DailyDabble</p>
          <p className="font-headline text-sm font-extrabold uppercase tracking-[0.16em] text-[#2f672d]">Welcome</p>
          <h2 id="display-name-dialog-title" className="font-headline mt-3 text-4xl font-extrabold leading-tight text-[#2c2f31]">
            Choose your display name
          </h2>
          <p className="mt-4 text-base font-semibold leading-relaxed text-[#595c5e]">
            Pick a display name before you keep playing.
          </p>

          <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]" htmlFor="displayName">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value.replace(/[^A-Za-z0-9]/g, ""));
                  setError("");
                }}
                minLength={2}
                maxLength={32}
                pattern="[A-Za-z0-9]+"
                autoComplete="nickname"
                autoFocus
                placeholder="Your display name"
                className="mt-2 h-[3.25rem] w-full rounded-full border border-[#d8dce2] bg-[#f5f6f9] px-5 text-base font-extrabold text-[#2c2f31] outline-none transition focus:border-[#2f672d] focus:bg-white focus:ring-4 focus:ring-[#b6f6ab]/45"
              />
              <p className="mt-2 text-xs font-semibold text-[#75777a]">2-32 characters. You can change it later.</p>
            </div>

            <button
              type="submit"
              disabled={saving || displayName.trim().length < 2}
              className="font-headline h-[3.25rem] rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-not-allowed disabled:bg-[#abadb0] disabled:text-white"
            >
              {saving ? "Saving..." : "Continue"}
            </button>

            {error ? <p className="text-sm font-bold text-[#b02500]">{error}</p> : null}
          </form>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
