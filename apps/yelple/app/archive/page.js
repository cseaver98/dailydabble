import Script from "next/script";
import MainNav from "../components/MainNav";

export const metadata = { title: "Yelple Archive" };

export default function ArchivePage() {
  return (
    <>
      <MainNav label="Archive games" />

      <main className="container">
        <section className="card archive-card">
          <div id="archiveList" className="archive-list archive-list-scroll" />
        </section>
      </main>

      <Script src="/nav.js" strategy="afterInteractive" />
      <Script src="/archive.js" strategy="afterInteractive" />
    </>
  );
}
