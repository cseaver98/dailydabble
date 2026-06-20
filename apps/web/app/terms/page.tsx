import { DailydabbleNav } from "@dailydabble/ui";

const legalContactEmail = "support@dailydabble.app";

export default function TermsPage() {
  return (
    <>
      <DailydabbleNav label="Terms of Use" headerClassName="hub-nav" />
      <main className="min-h-screen bg-transparent px-5 pb-12 text-[#2c2f31] sm:px-8">
        <section className="mx-auto mt-6 max-w-4xl rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_rgba(44,47,49,0.06)] sm:p-10">
          <h1 className="font-headline text-3xl font-extrabold text-[#2c2f31]">Terms of Use</h1>
          <p className="mt-2 text-sm text-[#595c5e]">Last updated March 26, 2026.</p>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#3e4245]">
            <p>
              DailyDabble and its games are provided for entertainment and informational use. By using any
              DailyDabble site, you agree not to misuse the service, interfere with operations, or attempt abusive
              scraping, automation, or other disruptive behavior.
            </p>
            <p>
              We may add, remove, or change puzzles, schedules, game mechanics, and features at any time. Some account,
              login, or cross-device features may be available now or introduced over time, and continued use of the
              service remains subject to these terms and our privacy policy.
            </p>
            <p>
              DailyDabble includes original game logic, curation, and editorial content. Third-party names, images,
              and references remain the property of their respective rights holders.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Use Of The Service</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Daily games, archive games, and account-related features may differ from one another and may change over time.</li>
              <li>Some parts of the service may rely on curated editorial context, reference material, and third-party source material.</li>
              <li>Archive access, unlock flows, and past scheduled content may not match the current day experience.</li>
            </ul>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Accounts And Access</h2>
            <p>
              If login or account features are offered, you are responsible for your access methods and for using those
              features lawfully. We may suspend or restrict access to protect the service, users, or our systems.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Intellectual Property And Claims</h2>
            <p>
              If you believe content on DailyDabble infringes your rights, contact {legalContactEmail} with the URL,
              ownership claim, and requested action.
            </p>

            <h2 className="font-headline pt-2 text-xl font-bold text-[#2c2f31]">Disclaimer</h2>
            <p>
              DailyDabble is provided as-is and as-available, without warranties of uninterrupted availability,
              accuracy, or fitness for a specific purpose.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
