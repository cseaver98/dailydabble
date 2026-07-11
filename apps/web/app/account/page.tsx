import type { Metadata } from "next";
import Link from "next/link";
import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../components/AccountNav";
import DailyDabbleWordmark from "../components/DailyDabbleWordmark";
import SiteMenu from "../components/SiteMenu";
import AccountLoginPanel from "./AccountLoginPanel";
import ProfileForm from "./ProfileForm";
import EmailPreferencesForm from "./EmailPreferencesForm";
import SignOutButton from "./SignOutButton";
import { getProfile } from "@/lib/account-profile";
import { getSubscriptionAccess } from "@/lib/subscriptions";
import { createSupabaseServerClient } from "@/lib/supabase-auth/server";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your DailyDabble account.",
  robots: { index: false, follow: false },
};

const isApplePrivateRelayEmail = (email: string) => email.toLowerCase().endsWith("@privaterelay.appleid.com");
const supportEmail = "support@dailydabble.app";

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
  const subscriptionAccess = await getSubscriptionAccess(user.id);
  const displayName = profile?.displayName ?? "Dabbler";
  const email = user.email ?? "Private email";
  const displayedEmail = isApplePrivateRelayEmail(email) ? "Private Apple relay email" : email;
  const createdAt = user.created_at ? new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(user.created_at)) : "Unknown";
  const displayNameHeadingClass = getDisplayNameHeadingClass(displayName);
  const plusStatusLabel = subscriptionAccess.flags.subscriptionsEnabled
    ? subscriptionAccess.isSubscriber
      ? "Active"
      : "Coming soon"
    : "Coming soon";
  const feedbackHref = `mailto:${supportEmail}?subject=${encodeURIComponent("DailyDabble feedback or bug report")}`;

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
                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-col sm:items-end">
                  {subscriptionAccess.canAccessSubscriberBadges ? (
                    <div className="relative flex h-[4.35rem] w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-[#dec46f] bg-[linear-gradient(135deg,#fff8d2_0%,#f4c95d_36%,#fff1a6_58%,#b8860b_100%)] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(156,111,10,0.16)] sm:w-[12.5rem] sm:px-4">
                      <div className="pointer-events-none absolute inset-y-0 left-1/4 w-8 rotate-12 bg-white/55 blur-md" />
                      <div className="relative">
                        <p className="whitespace-nowrap text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[#7a5200] sm:text-xs sm:tracking-[0.14em]">Subscriber</p>
                        <p className="mt-1 text-xs sm:text-base">
                          <DailyDabbleWordmark plus className="justify-center text-[1em]" />
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="relative flex h-[4.35rem] w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-[#cfd5dc] bg-[linear-gradient(135deg,#ffffff_0%,#d9dee4_34%,#f8fafc_54%,#b8c0ca_100%)] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(44,47,49,0.08)] sm:w-[12.5rem] sm:px-4">
                    <div className="pointer-events-none absolute inset-y-0 left-1/4 w-8 rotate-12 bg-white/45 blur-md" />
                    <div className="relative">
                    <p className="whitespace-nowrap text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-[#75777a] sm:text-xs sm:tracking-[0.14em]">Member since</p>
                    <p className="mt-1 whitespace-nowrap text-xs font-extrabold text-[#2c2f31] sm:text-base">{createdAt}</p>
                    </div>
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
                  <p className="mt-1 break-words text-base font-extrabold text-[#2c2f31]">{displayedEmail}</p>
                </div>
                <div className="rounded-2xl border border-[#d8dce2] bg-[#fdfefe] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Plan</p>
                      <p className="mt-1 text-base font-extrabold text-[#2c2f31]">
                        {subscriptionAccess.isSubscriber ? <DailyDabbleWordmark plus className="text-base" /> : "Free"}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#595c5e]">
                        {subscriptionAccess.flags.subscriptionsEnabled
                          ? subscriptionAccess.isSubscriber
                            ? <>Your account is ready for <DailyDabbleWordmark plus className="text-[1em]" /> features as they launch.</>
                            : <><DailyDabbleWordmark plus className="text-[1em]" /> will unlock archive access, premium stats, and account badges.</>
                          : <><DailyDabbleWordmark plus className="text-[1em]" /> is being prepared in the background. Archive access, premium stats, and badges are coming later.</>}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] ${
                      subscriptionAccess.isSubscriber
                        ? "bg-[#d1ffc7] text-[#114c15]"
                        : "bg-[#eff1f4] text-[#595c5e]"
                    }`}>
                      {plusStatusLabel}
                    </span>
                  </div>
                </div>
                <EmailPreferencesForm
                  initialMarketingEmailOptIn={profile?.marketingEmailOptIn ?? false}
                  initialDailyReminderOptIn={profile?.dailyReminderOptIn ?? false}
                />
                <div className="rounded-2xl border border-[#d8dce2] bg-[#fdfefe] px-4 py-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#75777a]">Feedback</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#595c5e]">
                    Found a bug or have an idea? Send us a note and we&apos;ll take a look.
                  </p>
                  <div className="mt-3">
                    <a
                      className="font-headline inline-flex h-11 items-center justify-center rounded-full bg-[#2f672d] px-5 text-sm font-extrabold text-[#d1ffc7] transition hover:bg-[#225b22]"
                      href={feedbackHref}
                    >
                      Send feedback
                    </a>
                  </div>
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
