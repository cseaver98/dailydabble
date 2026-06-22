import { DailydabbleNav } from "@dailydabble/ui";
import AccountNav from "../components/AccountNav";
import SiteMenu from "../components/SiteMenu";

const legalContactEmail = "support@dailydabble.app";

export default function PrivacyPage() {
  return (
    <>
      <DailydabbleNav label="Privacy Policy" headerClassName="hub-nav" leftContent={<SiteMenu />} rightContent={<AccountNav />} />
      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
          <h1 className="font-headline text-3xl font-extrabold text-[#2c2f31]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#595c5e]">Last updated March 26, 2026.</p>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#3e4245]">
            <p>
              DailyDabble stores some game data locally in your browser and some operational game data on our servers.
              This can include in-progress puzzle state, guesses, completion status, and related records needed to run
              the games and show your current progress.
            </p>
            <p>
              We store puzzle content, scheduling data, player identifiers, and basic operational records in
              Supabase-backed systems and related infrastructure. Our service providers may also process standard
              technical logs such as IP address, browser details, device information, and request metadata for
              security, reliability, and abuse prevention.
            </p>
            <p>
              We do not sell personal data. If we materially change what personal data we collect or how we use it, we
              will update this policy.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Cookies And Local Storage</h2>
            <p>
              DailyDabble uses browser storage and cookies to keep the games working. This may include local storage for
              active game sessions and completion state, a persistent player identifier cookie, and limited access
              cookies used for features like archive unlocking.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Accounts And Authentication</h2>
            <p>
              Some account, sign-in, or cross-device features may be available now or expanded over time. When you use
              those features, we may process account identifiers, authentication state, and related records needed to
              provide access and keep your account secure.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Game And Editorial Content</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Games may use curated puzzle records, scheduling data, and editorial context to power gameplay and results.</li>
              <li>Some games may display images, descriptions, or other reference material as part of the play experience.</li>
              <li>Hub and game completion status may be stored server-side to reflect your results across DailyDabble.</li>
            </ul>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Your Choices</h2>
            <p>
              You can clear local game data at any time by clearing site storage in your browser. If you have privacy
              questions or requests, contact {legalContactEmail}.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
