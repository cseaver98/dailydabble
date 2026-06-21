"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth/client";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className = "" }: SignOutButtonProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={signingOut}
      className={className || "font-headline inline-flex h-12 w-full items-center justify-center rounded-full bg-[#fff0ed] px-5 text-sm font-extrabold text-[#b02500] transition hover:bg-[#ffe0d9] disabled:cursor-wait disabled:opacity-70"}
    >
      {signingOut ? "Signing out..." : "Log out"}
    </button>
  );
}
