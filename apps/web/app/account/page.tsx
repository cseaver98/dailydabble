import type { Metadata } from "next";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../components/AccountNav";
import SiteMenu from "../components/SiteMenu";
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

const getDisplayNameHeadingClass = (displayName: string) => {
  if (displayName.length > 24) {
    return "text-2xl sm:text-4xl";
  }

  if (displayName.length > 16) {
    return "text-[1.7rem] sm:text-5xl";
  }

  return "text-3xl sm:text-6xl";
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
        <main className="min-h-screen bg-transparent px-5 pb-12 pt-10 text-[#2c2f31] sm:px-8">
          <AccountLoginPanel />
        </main>
      </>
    );
  }

  const profile = await getProfile(user.id);
  const displayName = profile?.displayName ?? "Dabbler";
  const email = user.email ?? "Private email";
  const provider = formatProvider(user.app_metadata?.provider);
  const createdAt = user.created_at ? new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(user.created_at)) : "Unknown";
  const displayNameHeadingClass = getDisplayNameHeadingClass(displayName);

  return (
    <>
      <DailydabbleNav headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 pt-8 text-[#2c2f31] sm:px-8">
        <section className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-white p-7 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
            <div className="relative flex flex-col gap-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <h1 className={`font-headline w-full min-w-0 flex-1 break-words font-extrabold leading-tight text-[#2c2f31] ${displayNameHeadingClass}`}>
                  {displayName}
                </h1>
                <div className="relative w-[calc(50%-0.5rem)] shrink-0 overflow-hidden rounded-2xl border border-[#cfd5dc] bg-[linear-gradient(135deg,#ffffff_0%,#d9dee4_34%,#f8fafc_54%,#b8c0ca_100%)] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(44,47,49,0.08)] sm:w-auto sm:text-right">
                  <div className="pointer-events-none absolute inset-y-0 left-1/4 w-8 rotate-12 bg-white/45 blur-md" />
                  <div className="relative">
                  <p className="whitespace-nowrap text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[#75777a] sm:text-xs sm:tracking-[0.14em]">Member since</p>
                  <p className="mt-1 whitespace-nowrap text-xs font-extrabold text-[#2c2f31] sm:text-base">{createdAt}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
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

          <div className="mt-6">
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
                <div className="rounded-2xl border border-[#ffd2c7] bg-[#fff8f6] px-4 py-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#b02500]">Session</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#7a4a3e]">
                    Your saved progress stays connected to your account.
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
