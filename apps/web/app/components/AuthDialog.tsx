"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AuthError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth/client";

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  mode?: "login" | "gate";
  title?: string;
  subtitle?: string;
  dismissible?: boolean;
  backHref?: string;
  backLabel?: string;
};

const getRedirectTo = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
};

const formatAuthError = (error: AuthError) => {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Login links are temporarily limited. Check your inbox, or try again in a few minutes.";
  }

  return error.message;
};

const stopEditableKeyPropagation = (event: KeyboardEvent<HTMLElement>) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    event.stopPropagation();
  }
};

export default function AuthDialog({
  isOpen,
  onClose,
  mode = "login",
  title: titleOverride,
  subtitle: subtitleOverride,
  dismissible = true,
  backHref,
  backLabel = "Back to hub",
}: AuthDialogProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | "email" | null>(null);

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

  if (!portalRoot || !isOpen) return null;

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
      setError(formatAuthError(signInError));
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
      setError(formatAuthError(signInError));
    } else {
      setMessage("Check your email for a secure login link.");
    }
    setLoadingProvider(null);
  };

  const title = titleOverride ?? "Log in or create an account";
  const subtitle =
    subtitleOverride ??
    (mode === "gate"
      ? "You have completed your free games. Log in to keep playing and save your stats."
      : "Save your stats, streaks, and progress across devices.");

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2c2f31]/45 px-4 backdrop-blur-sm"
      onClick={dismissible ? onClose : undefined}
    >
      <section
        className="relative w-full max-w-md rounded-[2rem] border border-[#d8dce2] bg-white p-6 shadow-[0_28px_80px_rgba(44,47,49,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={stopEditableKeyPropagation}
      >
        {dismissible ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login dialog"
            className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#eff1f4] text-lg font-bold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
          >
            ×
          </button>
        ) : null}

        <div className={`mb-6 ${dismissible ? "pr-8" : ""}`}>
          <p className="dd-brand-word mb-2 inline-block !text-xl">DailyDabble</p>
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
            className="font-headline flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full border border-[#d8dce2] bg-white px-4 text-sm font-extrabold text-[#2c2f31] transition hover:border-[#2f672d]/40 hover:bg-[#f5f6f9] disabled:cursor-wait disabled:opacity-70"
          >
            <span className="grid w-[190px] grid-cols-[1.25rem_1fr] items-center gap-2.5 text-left">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84C3.96 20.53 7.68 23 12 23z" />
                <path fill="#fbbc05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.15C1.41 8.53 1 10.22 1 12s.41 3.47 1.15 4.94l3.69-2.84z" />
                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.68 1 3.96 3.47 2.15 7.06l3.69 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
              </svg>
              <span>{loadingProvider === "google" ? "Opening Google..." : "Continue with Google"}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void signInWithProvider("apple")}
            disabled={loadingProvider !== null}
            className="font-headline flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#2c2f31] px-4 text-sm font-extrabold text-white transition hover:bg-[#111315] disabled:cursor-wait disabled:opacity-70"
          >
            <span className="grid w-[190px] grid-cols-[1.25rem_1fr] items-center gap-2.5 text-left">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.15-3.68 1.09-4.62 1.09zM15.53 3.83C16.37 2.82 16.93 1.4 16.78 0c-1.21.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.71-.69 3.55-1.7z" />
              </svg>
              <span>{loadingProvider === "apple" ? "Opening Apple..." : "Continue with Apple"}</span>
            </span>
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
            className="font-headline h-12 cursor-pointer rounded-full bg-[#2f672d] px-4 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22] disabled:cursor-wait disabled:opacity-70"
          >
            {loadingProvider === "email" ? "Sending link..." : "Send login link"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm font-bold text-[#2f672d]">{message}</p> : null}
        {error ? <p className="mt-4 text-sm font-bold text-[#b02500]">{error}</p> : null}
        {backHref ? (
          <a
            href={backHref}
            className="mt-5 inline-flex w-full items-center justify-center text-sm font-bold text-[#595c5e] underline decoration-[#abadb0] underline-offset-4 transition hover:text-[#2c2f31]"
          >
            {backLabel}
          </a>
        ) : null}
      </section>
    </div>,
    portalRoot,
  );
}
