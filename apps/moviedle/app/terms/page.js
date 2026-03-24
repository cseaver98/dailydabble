import MainNav from "../components/MainNav";

export default function TermsPage() {
  return (
    <>
      <MainNav label="Terms" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Terms</h1>
          <p className="page-subtle">Moviedle is provided for entertainment gameplay.</p>
        </section>
      </main>
    </>
  );
}
