import MainNav from "../components/MainNav";

export default function PrivacyPage() {
  return (
    <>
      <MainNav label="Privacy" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Privacy</h1>
          <p className="page-subtle">Sportle stores your game progress on-device in your browser.</p>
        </section>
      </main>
    </>
  );
}
