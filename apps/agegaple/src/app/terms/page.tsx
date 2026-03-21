import LegalPageShell from "@/components/legal-page-shell";

const legalContactEmail = process.env.LEGAL_CONTACT_EMAIL ?? "contact@agegaple.com";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" updatedLabel="Last updated March 14, 2026.">
      <p>
        Agegaple is an entertainment and editorial trivia project. The site presents public-interest facts,
        editorial context, and commentary about celebrity relationships and age-gap trivia.
      </p>
      <p>
        Certain limited uses of third-party materials on Agegaple may be made in reliance on fair-use
        principles and other applicable legal doctrines. All third-party content remains the property of its
        respective rights holders.
      </p>
      <p>
        By using the site, you agree not to misuse, disrupt, scrape at abusive volume, or attempt to interfere
        with the service. We may remove or change content at any time.
      </p>
      <p>
        If you believe material on Agegaple infringes your rights, contact {legalContactEmail} and include the
        URL, your ownership claim, and the requested action.
      </p>
      <p>
        Agegaple is provided as-is without warranties. We may suspend or discontinue the service at any time.
      </p>
    </LegalPageShell>
  );
}
