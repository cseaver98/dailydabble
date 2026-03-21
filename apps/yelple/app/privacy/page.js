import Script from "next/script";
import MainNav from "../components/MainNav";

export const metadata = { title: "Yelple Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <MainNav label="Privacy policy" />

      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="subtle page-subtle">Last updated: March 14, 2026</p>

          <h2>1. Overview</h2>
          <p>Yelple is designed to collect minimal personal data. This policy explains what may be collected and how used.</p>

          <h2>2. Data Stored in Your Browser</h2>
          <p>
            Yelple stores gameplay streak data in local storage so your streak can persist on the same device/browser.
          </p>

          <h2>3. Server Data</h2>
          <p>
            Yelple may store gameplay events such as challenge date, guessed rating, and correctness for analytics and product
            quality.
          </p>

          <h2>4. Third-Party Providers</h2>
          <p>Yelple may request business content from third-party providers, including Yelp APIs.</p>

          <h2>5. Cookies and Tracking</h2>
          <p>Yelple does not currently rely on complex tracking cookies for gameplay.</p>

          <h2>6. Data Retention</h2>
          <p>Provider content may be cached temporarily and purged according to provider requirements.</p>

          <h2>7. Your Choices</h2>
          <p>You can clear local storage at any time to reset streak data.</p>

          <h2>8. Security</h2>
          <p>Reasonable safeguards are used, but no method of storage or transmission is fully secure.</p>

          <h2>9. Children</h2>
          <p>Yelple is not intended for children under 13.</p>

          <h2>10. Changes and Contact</h2>
          <p>
            For privacy requests or questions, contact: <a href="mailto:privacy@yelple.example">privacy@yelple.example</a>
          </p>
        </section>
      </main>

      <Script src="/nav.js" strategy="afterInteractive" />
    </>
  );
}
