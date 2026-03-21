import Script from "next/script";
import MainNav from "./components/MainNav";

export default function HomePage() {
  return (
    <>
      <MainNav label="" />

      <main className="container">
        <section className="card" id="gameCard">
          <div className="review-carousel">
            <div id="hintsList" className="hint-cards" />
          </div>

          <div className="guess-row" id="guessButtons" />
          <p id="message" className="message" />
        </section>
      </main>

      <dialog id="photoDialog" className="photo-dialog" aria-label="Expanded review photo">
        <button id="photoDialogCloseBtn" className="photo-dialog-close" type="button" aria-label="Close photo viewer">
          ✕
        </button>
        <div className="photo-dialog-stage">
          <button id="photoDialogPrevBtn" className="photo-dialog-nav photo-dialog-prev" type="button" aria-label="Previous photo">
            ←
          </button>
          <img id="photoDialogImage" className="photo-dialog-image" alt="Expanded review photo" />
          <button id="photoDialogNextBtn" className="photo-dialog-nav photo-dialog-next" type="button" aria-label="Next photo">
            →
          </button>
        </div>
        <p id="photoDialogCaption" className="photo-dialog-caption" />
      </dialog>

      <dialog id="resultsDialog" className="results-dialog" aria-label="Game results">
        <button id="resultsDialogCloseBtn" className="results-dialog-close" type="button" aria-label="Close results">
          ✕
        </button>
        <h2 id="resultsTitle" className="results-title" />
        <div className="results-map-wrap">
          <iframe
            id="resultsMap"
            className="results-map"
            title="Restaurant location map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="results-body">
          <p id="resultsSummary" className="results-summary" />
          <p id="resultsBusinessName" className="results-business-name" />
          <p id="resultsBusinessMeta" className="results-business-meta" />
          <div className="results-guess-history-wrap">
            <p className="results-guess-history-title">Guess history</p>
            <ul id="resultsGuessHistory" className="results-guess-history" />
          </div>
          <a id="resultsYelpLink" className="results-yelp-link" href="#" target="_blank" rel="noopener noreferrer" hidden>
            View on Yelp
          </a>
        </div>
      </dialog>

      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
