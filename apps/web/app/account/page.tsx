import type { Metadata } from "next";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../components/AccountNav";
import AccountLoginPanel from "./AccountLoginPanel";
import ProfileForm from "./ProfileForm";
import SignOutButton from "./SignOutButton";
import { getProfile } from "@/lib/account-profile";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";

export const metadata: Metadata = {
  title: "Account | DailyDabble",
  description: "Manage your DailyDabble account.",
};

const formatProvider = (provider?: string) => {
  if (!provider) return "Email";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <DailydabbleNav headerClassName="hub-nav" rightContent={<AccountNav />} />
        <main className="min-h-screen bg-transparent px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
          <AccountLoginPanel />
        </main>
      </>
    );
  }

  const profile = await getProfile(user.id);
  const displayName = profile?.displayName ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Dabbler";
  const email = user.email ?? "Private email";
  const provider = formatProvider(user.app_metadata?.provider);
  const createdAt = user.created_at ? new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(user.created_at)) : "Unknown";

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-white p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#b6f6ab]/55 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-28 left-12 h-56 w-56 rounded-full bg-[#fbe276]/45 blur-2xl" />
            <div className="relative">
              <p className="font-headline text-xs font-extrabold uppercase tracking-[0.18em] text-[#2f672d]">DailyDabble Account</p>
              <h1 className="font-headline mt-3 text-4xl font-extrabold leading-tight text-[#2c2f31] sm:text-6xl">
                {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-base font-semibold text-[#595c5e] sm:text-lg">
                Manage your account basics here. Stats now live on their own page so this stays nice and tidy.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/account/stats"
                  className="font-headline inline-flex h-12 items-center justify-center rounded-full bg-[#2f672d] px-6 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
                >
                  View stats
                </Link>
                <Link
                  href="/"
                  className="font-headline inline-flex h-12 items-center justify-center rounded-full bg-[#eff1f4] px-6 text-sm font-extrabold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
                >
                  Back to games
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)]">
              <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Profile</p>
              <div className="mt-5 grid gap-3">
                <ProfileForm initialDisplayName={displayName} />
                <div className="rounded-2xl bg-[#f5f6f9] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Email</p>
                  <p className="mt-1 break-words text-base font-extrabold text-[#2c2f31]">{email}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f6f9] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Login provider</p>
                  <p className="mt-1 text-base font-extrabold text-[#2c2f31]">{provider}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-[0_18px_36px_rgba(44,47,49,0.05)]">
              <p className="font-headline text-2xl font-extrabold text-[#2c2f31]">Account Settings</p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-[#e0e3e6] bg-[#fdfefe] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Member since</p>
                  <p className="mt-1 text-base font-extrabold text-[#2c2f31]">{createdAt}</p>
                </div>
                <div className="rounded-2xl border border-[#e0e3e6] bg-[#fdfefe] px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Stats</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#595c5e]">
                    View your basic stats now. Advanced stats and subscriber features can slot in later.
                  </p>
                  <Link
                    href="/account/stats"
                    className="font-headline mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#eff1f4] px-4 text-sm font-extrabold text-[#2c2f31] transition hover:bg-[#e0e3e6]"
                  >
                    Open stats
                  </Link>
                </div>
                <div className="rounded-2xl border border-[#ffd2c7] bg-[#fff8f6] px-4 py-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#b02500]">Session</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#7a4a3e]">
                    Log out on this device. Your saved progress stays connected to your account.
                  </p>
                  <div className="mt-3">
                    <SignOutButton />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
