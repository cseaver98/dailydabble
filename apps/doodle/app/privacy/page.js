import MainNav from "../components/MainNav";

export default function PrivacyPage() {
  return (
    <>
      <MainNav label="Privacy policy" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Privacy Policy</h1>
          <p className="page-subtle">Doodle MVP stores only local game progress for your browser.</p>
        </section>
      </main>
    </>
  );
}
