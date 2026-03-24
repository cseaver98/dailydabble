import MainNav from "../components/MainNav";

export default function PrivacyPage() {
  return (
    <>
      <MainNav label="Privacy policy" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-subtle">
            Yeardle stores your game progress locally in your browser and reads puzzle content from Supabase.
          </p>
        </section>
      </main>
    </>
  );
}
