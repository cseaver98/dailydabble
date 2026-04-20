import { DailydabbleNav } from "@dailydabble/ui";

const legalContactEmail = process.env.LEGAL_CONTACT_EMAIL ?? "legal@dailydabble.app";

export default function PrivacyPage() {
  return (
    <>
      <DailydabbleNav label="Privacy Policy" headerClassName="hub-nav" />
      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
          <h1 className="font-headline text-3xl font-extrabold text-[#2c2f31]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#595c5e]">Last updated March 26, 2026.</p>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#3e4245]">
            <p>
              Dailydabble currently stores most game progress locally in your browser (for example guesses, completion
              state, and in-progress puzzle state).
            </p>
            <p>
              We may store puzzle content, scheduling, and basic operational records in Supabase-backed databases. Our
              infrastructure providers may process standard technical logs such as IP address, request metadata, and
              browser details for security, reliability, and abuse prevention.
            </p>
            <p>
              We do not currently sell personal data. If optional sign-in, analytics, or cross-device history are introduced,
              this policy will be updated before those features go live.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Game-Specific Notes</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Agegaple includes editorial metadata and curation records for puzzle operations.</li>
              <li>Doodle, Equadle, Sportle, Moviedle, and Yeardle use local game-state storage for active play sessions.</li>
              <li>Hub completion status reflects your game results and may be persisted server-side when enabled.</li>
            </ul>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Your Choices</h2>
            <p>
              You can clear local game data at any time by clearing site storage in your browser. For privacy requests,
              contact {legalContactEmail}.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
