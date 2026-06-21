"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthDialog from "./AuthDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth/client";

type AccountUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export default function AccountNav() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const response = await fetch("/api/auth/session", { method: "GET" }).catch(() => null);
      if (!isMounted) return;
      if (!response?.ok) {
        setUser(null);
        setLoading(false);
        return;
      }
      const payload = await response.json().catch(() => ({ user: null }));
      setUser(payload.user ?? null);
      setLoading(false);
    };

    void loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });
    window.addEventListener("dailydabble:profile-updated", loadUser);

    return () => {
      isMounted = false;
      window.removeEventListener("dailydabble:profile-updated", loadUser);
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsMenuOpen(false);
    if (window.location.pathname.startsWith("/account")) {
      window.location.href = "/";
    }
  };

  if (loading) {
    return (
      <span className="font-headline inline-flex h-[36px] items-center justify-center rounded-full bg-[#eff1f4] px-5 text-sm font-bold text-[#75777a]">
        Loading
      </span>
    );
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsAuthOpen(true)}
          className="font-headline inline-flex h-[36px] items-center justify-center rounded-full bg-[#2f672d] px-5 text-sm font-bold text-[#d1ffc7] transition hover:opacity-90"
        >
          Login
        </button>
        <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </>
    );
  }

  const label = user.displayName || user.email || "Account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsMenuOpen((current) => !current)}
        className="font-headline inline-flex h-[36px] max-w-[190px] items-center justify-center truncate rounded-full bg-[#d1ffc7] px-5 text-sm font-bold text-[#225b22] transition hover:bg-[#b6f6ab]"
      >
        {label}
      </button>

      {isMenuOpen ? (
        <div className="absolute right-0 top-11 z-[80] w-56 rounded-2xl border border-[#d8dce2] bg-white p-2 shadow-[0_18px_50px_rgba(44,47,49,0.16)]">
          <p className="px-3 py-2 text-xs font-bold text-[#75777a]">Signed in as</p>
          <p className="truncate px-3 pb-2 text-sm font-extrabold text-[#2c2f31]">{label}</p>
          <div className="my-1 h-px bg-[#eff1f4]" />
          <Link
            href="/account"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#2c2f31] transition hover:bg-[#eff1f4]"
          >
            Account
          </Link>
          <Link
            href="/account/stats"
            onClick={() => setIsMenuOpen(false)}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#2c2f31] transition hover:bg-[#eff1f4]"
          >
            Stats
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#b02500] transition hover:bg-[#fff0ed]"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
