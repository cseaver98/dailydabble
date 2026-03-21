import Script from "next/script";
import MainNav from "../components/MainNav";

export const metadata = { title: "Yelple Terms" };

export default function TermsPage() {
  return (
    <>
      <MainNav label="Terms of use" />

      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Terms of Use</h1>
          <p className="subtle page-subtle">Last updated: March 14, 2026</p>

          <h2>1. Acceptance</h2>
          <p>By using Yelple, you agree to these Terms. If you do not agree, do not use the service.</p>

          <h2>2. Service Description</h2>
          <p>
            Yelple is an entertainment game where users guess business star ratings from review excerpts and images. Features
            may change, pause, or be removed at any time.
          </p>

          <h2>3. Third-Party Content</h2>
          <p>
            Yelple may display third-party content, including content sourced from Yelp APIs. Yelp names, marks, and content
            remain the property of Yelp and applicable owners. Use of third-party content is subject to those providers&apos;
            terms.
          </p>

          <h2>4. No Guarantees</h2>
          <p>Content may be incomplete, outdated, or unavailable. Yelple is provided on an &quot;as is&quot; basis.</p>

          <h2>5. Acceptable Use</h2>
          <p>
            You agree not to misuse the service, interfere with operation, attempt unauthorized access, or use automation to
            overload the app.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            Yelple branding, design, and original code are protected by applicable intellectual property laws. You may not copy
            or redistribute protected material except as allowed by law.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent allowed by law, Yelple and its operators are not liable for indirect or consequential damages.
          </p>

          <h2>8. Indemnity</h2>
          <p>You agree to indemnify and hold harmless Yelple and its operators from claims caused by your misuse.</p>

          <h2>9. Changes to Terms</h2>
          <p>These Terms may be updated at any time. Continued use after updates means you accept the revised Terms.</p>

          <h2>10. Contact</h2>
          <p>
            For legal or policy questions, contact: <a href="mailto:legal@yelple.example">legal@yelple.example</a>
          </p>
        </section>
      </main>

      <Script src="/nav.js" strategy="afterInteractive" />
    </>
  );
}
