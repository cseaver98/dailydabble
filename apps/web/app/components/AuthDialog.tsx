"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth/client";

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  mode?: "login" | "gate";
};

const getRedirectTo = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
};

export default function AuthDialog({ isOpen, onClose, mode = "login" }: AuthDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | "email" | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const signInWithProvider = async (provider: "google" | "apple") => {
    setError("");
    setMessage("");
    setLoadingProvider(provider);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getRedirectTo(),
        ...(provider === "google" ? { scopes: "https://www.googleapis.com/auth/userinfo.email" } : {}),
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoadingProvider(null);
    }
  };

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email first.");
      return;
    }

    setError("");
    setMessage("");
    setLoadingProvider("email");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: getRedirectTo(),
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Check your email for a secure login link.");
    }
    setLoadingProvider(null);
  };

  const title = mode === "gate" ? "Create an account to keep playing" : "Create your free DailyDabble account";
  const subtitle = mode === "gate"
    ? "You have completed your free games. Sign in to keep playing and save your stats."
    : "Save your stats, streaks, and progress across devices.";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2c2f31]/45 px-4 backdrop-blur-sm" onClick={onClose}>
      <section
        className="relative w-full max-w-md rounded-[2rem] border border-[#d8dce2] bg-white p-6 shadow-[0_28px_80px_rgba(44,47,49,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close login dialog"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eff1f4] text-lg font-bold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
        >
          ×
        </button>

        <div className="mb-6 pr-8">
          <p className="mb-2 font-headline text-xs font-extrabold uppercase tracking-[0.18em] text-[#2f672d]">DailyDabble</p>
          <h2 id="auth-dialog-title" className="font-headline text-3xl font-extrabold leading-tight text-[#2c2f31]">
            {title}
          </h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-[#595c5e]">{subtitle}</p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => void signInWithProvider("google")}
            disabled={loadingProvider !== null}
            className="font-headline flex h-12 items-center justify-center rounded-full border border-[#d8dce2] bg-white px-4 text-sm font-extrabold text-[#2c2f31] transition hover:border-[#2f672d]/40 hover:bg-[#f5f6f9] disabled:cursor-wait disabled:opacity-70"
          >
            {loadingProvider === "google" ? "Opening Google..." : "Continue with Google"}
          </button>
          <button
            type="button"
            onClick={() => void signInWithProvider("apple")}
            disabled={loadingProvider !== null}
            className="font-headline flex h-12 items-center justify-center rounded-full bg-[#2c2f31] px-4 text-sm font-extrabold text-white transition hover:bg-[#111315] disabled:cursor-wait disabled:opacity-70"
          >
            {loadingProvider === "apple" ? "Opening Apple..." : "Continue with Apple"}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#75777a]">
          <span className="h-px flex-1 bg-[#e0e3e6]" />
          Email
          <span className="h-px flex-1 bg-[#e0e3e6]" />
        </div>

        <form className="grid gap-3" onSubmit={sendMagicLink}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-12 rounded-full border border-[#d8dce2] bg-[#f5f6f9] px-4 text-base font-semibold text-[#2c2f31] outline-none transition focus:border-[#2f672d] focus:bg-white focus:ring-4 focus:ring-[#b6f6ab]/50"
          />
          <button
            type="submit"
            disabled={loadingProvider !== null}
            className="font-headline h-12 rounded-full bg-[#2f672d] px-4 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-wait disabled:opacity-70"
          >
            {loadingProvider === "email" ? "Sending link..." : "Send magic link"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm font-bold text-[#2f672d]">{message}</p> : null}
        {error ? <p className="mt-4 text-sm font-bold text-[#b02500]">{error}</p> : null}
      </section>
    </div>,
    document.body,
  );
}
