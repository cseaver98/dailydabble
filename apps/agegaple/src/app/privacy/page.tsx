import LegalPageShell from "@/components/legal-page-shell";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updatedLabel="Last updated March 14, 2026.">
      <p>
        Agegaple stores minimal gameplay information needed to operate the daily puzzle, such as guesses and
        basic local progress state in your browser.
      </p>
      <p>
        Server logs and infrastructure providers may collect standard technical information like IP address,
        browser type, and request timing for security and reliability.
      </p>
      <p>
        Agegaple does not currently sell personal data. If analytics, ads, or additional tracking are added in
        the future, this page should be updated before those features go live.
      </p>
    </LegalPageShell>
  );
}
