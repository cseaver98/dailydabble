import { DailydabbleNav } from "@dailydabble/ui";

const legalContactEmail = process.env.LEGAL_CONTACT_EMAIL ?? "legal@dailydabble.app";

export default function TermsPage() {
  return (
    <>
      <DailydabbleNav subtitle="Dailydabble" label="Terms of Use" headerClassName="hub-nav" />
      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
          <h1 className="font-headline text-3xl font-extrabold text-[#2c2f31]">Terms of Use</h1>
          <p className="mt-2 text-sm text-[#595c5e]">Last updated March 26, 2026.</p>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#3e4245]">
            <p>
              Dailydabble and its games are provided for entertainment and educational use. By using any Dailydabble site,
              you agree not to misuse the service, interfere with operations, or attempt abusive scraping or automated abuse.
            </p>
            <p>
              We may add, remove, or change puzzles, schedules, and features at any time. Optional account features may be
              introduced later; if they are, these terms and the privacy policy will be updated before launch.
            </p>
            <p>
              Dailydabble content includes original game logic, curation, and editorial writing. Third-party images, names,
              and references remain the property of their respective rights holders.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Game-Specific Notes</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Agegaple includes editorial and commentary context around public figures and relationships. Some limited use of
                third-party material may rely on fair-use and related legal doctrines where applicable.
              </li>
              <li>Doodle, Equadle, Sportle, Moviedle, and Yeardle are daily challenge games provided on an as-is basis.</li>
              <li>Archive modes may expose past scheduled puzzles and may differ from the current day experience.</li>
            </ul>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Intellectual Property And Claims</h2>
            <p>
              If you believe content on Dailydabble infringes your rights, contact {legalContactEmail} with the URL,
              ownership claim, and requested action.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Disclaimer</h2>
            <p>
              Dailydabble is provided as-is and as-available, without warranties of uninterrupted availability,
              accuracy, or fitness for a specific purpose.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
