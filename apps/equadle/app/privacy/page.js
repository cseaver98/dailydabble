import MainNav from "../components/MainNav";

export default function PrivacyPage() {
  return (
    <>
      <MainNav label="Privacy policy" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-subtle">Equadle stores gameplay progress in your browser and puzzle metadata in Supabase.</p>
        </section>
      </main>
    </>
  );
}
