import Script from "next/script";
import MainNav from "./components/MainNav";

export default function HomePage() {
  return (
    <>
      <MainNav label="" />

      <main className="container">
        <section className="card" id="gameCard">
          <div className="game-card-topbar">
            <p id="nextGameTimer" className="next-game-timer" hidden />
          </div>
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
        <div className="results-header">
          <h2 id="resultsTitle" className="results-title" />
          <p id="resultsNextGameTimer" className="results-next-game-timer" hidden />
        </div>
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
          <div className="results-actions">
            <a id="resultsYelpLink" className="results-yelp-link" href="#" target="_blank" rel="noopener noreferrer" hidden>
              View on Yelp
            </a>
            <button id="resultsShareBtn" type="button" className="results-share-btn">
              <span className="results-share-content">
                Share
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M8.7 10.7 15.3 6.3M8.7 13.3l6.6 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <a id="resultsArchiveBtn" className="results-archive-btn" href="/archive">
              Play Archive Games
            </a>
          </div>
          <p id="resultsShareStatus" className="results-share-status" />
        </div>
      </dialog>

      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
