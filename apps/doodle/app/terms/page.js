import MainNav from "../components/MainNav";

export default function TermsPage() {
  return (
    <>
      <MainNav label="Terms of use" />
      <main className="container">
        <section className="card legal-card">
          <h1 className="page-title">Terms of Use</h1>
          <p className="page-subtle">Doodle is provided as-is during MVP development.</p>
        </section>
      </main>
    </>
  );
}
