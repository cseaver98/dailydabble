"use client";

import { useEffect, useState, type CSSProperties, type ReactNode, type SVGProps } from "react";
import AsyncImage from "./AsyncImage";
import { DOODLE_TUTORIAL, EQUADLE_TUTORIAL, SPORTLE_TUTORIAL, VERBLE_TUTORIAL } from "./how-to-play-fixtures";

export type HowToPlayGame =
  | "agegaple"
  | "doodle"
  | "equadle"
  | "moviedle"
  | "sportle"
  | "verble"
  | "yeardle";

type HowToPlayDialogProps = {
  game: HowToPlayGame;
  maxGuesses: number;
  equationLength?: number;
  preview?: TutorialPreviewData;
  onClose: () => void;
};

export type TutorialPreviewData = {
  people?: Array<{
    name: string;
    photoYear: number;
    imageUrl: string;
    imageAlt: string;
  }>;
  doodle?: {
    viewBox: string;
    segments: ReadonlyArray<{
      d: string;
      fill: string;
      fillRule?: SVGProps<SVGPathElement>["fillRule"];
      stroke: string;
      strokeWidth: string;
      strokeLinecap?: SVGProps<SVGPathElement>["strokeLinecap"];
      strokeLinejoin?: SVGProps<SVGPathElement>["strokeLinejoin"];
      opacity: string;
      fillOpacity: string;
      strokeOpacity: string;
    }>;
  };
  image?: {
    url: string;
    alt: string;
    title?: string;
  };
};

type TutorialPage = {
  eyebrow: string;
  heading: string;
  copy: ReactNode;
  visual: ReactNode;
};

type Tutorial = {
  title: string;
  subtitle: string;
  pages: TutorialPage[];
};

type TileState = "correct" | "present" | "absent" | "draft" | "locked" | "target";

function VerbleTileRow({
  values,
  states = [],
  selected = false,
  trailingFixed = {},
  animateReveals = true,
  animateTyping = false,
  entryOrder = [],
}: {
  values: readonly string[];
  states?: readonly TileState[];
  selected?: boolean;
  trailingFixed?: Record<number, string>;
  animateReveals?: boolean;
  animateTyping?: boolean;
  entryOrder?: readonly (number | null)[];
}) {
  return (
    <div className={`slot-cluster tutorial-verble-word${animateReveals ? " tutorial-verble-animate-reveals" : ""}${animateTyping ? " tutorial-verble-typing-word" : ""}`} aria-hidden="true">
      <span className={`slot-word-button${selected ? " selected" : ""}`}>
        <span className="slot-tiles">
          {values.map((value, index) => (
            <span className="slot-char-group" key={`${value}-${index}`}>
              <span className={`slot-tile ${states[index] ?? ""} ${value ? "filled" : ""}`}>
                {entryOrder[index] != null && value ? (
                  <span
                    className="tutorial-verble-full-entry"
                    style={{ "--tutorial-entry-delay": `${0.35 + (entryOrder[index] ?? 0) * 0.16}s` } as CSSProperties}
                  >
                    {value}
                  </span>
                ) : animateTyping && value ? <span className="tutorial-verble-typed-letter">{value}</span> : value}
              </span>
              {trailingFixed[index] ? (
                <span className={`slot-inline-fixed${trailingFixed[index].includes("'") ? " apostrophe" : ""}`}>
                  {trailingFixed[index]}
                </span>
              ) : null}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

function VerblePhraseExample({ stage }: { stage: "typing" | "feedback" | "revealed" }) {
  const isRevealed = stage === "revealed";
  const isGuessing = stage === "typing" || stage === "feedback";

  return (
    <div className="phrase-layout tutorial-verble-phrase">
      <VerbleTileRow
        values={["R", "O", "M", "E"]}
        states={["correct", "correct", "correct", "correct"]}
        animateReveals={false}
      />
      <VerbleTileRow
        values={isRevealed ? ["", "", "", "", "T"] : ["", "", "", "", ""]}
        states={isRevealed ? ["draft", "draft", "draft", "draft", "correct"] : undefined}
        trailingFixed={{ 3: "'" }}
      />
      <VerbleTileRow
        values={isGuessing ? VERBLE_TUTORIAL.wordGuess.split("") : ["", "", "I", "", "T"]}
        states={stage === "feedback" ? VERBLE_TUTORIAL.wordGuessFeedback : isRevealed ? ["draft", "draft", "correct", "draft", "correct"] : ["draft", "draft", "draft", "draft", "draft"]}
        selected={stage === "typing"}
        animateTyping={stage === "typing"}
      />
      <VerbleTileRow
        values={isRevealed ? ["I", ""] : ["", ""]}
        states={isRevealed ? ["correct", "draft"] : undefined}
      />
      <VerbleTileRow values={[""]} />
      <VerbleTileRow values={["", "", ""]} />
    </div>
  );
}

function VerbleGuessFlow() {
  return (
    <div className="tutorial-verble-flow tutorial-game-preview" role="img" aria-label="Animated example showing a word guess revealing letters across the phrase">
      <div className="tutorial-verble-stage-labels">
        <span className="tutorial-verble-step-label tutorial-verble-label-guessing">Guessing BUILT</span>
        <span className="tutorial-verble-step-label tutorial-verble-label-updated">Phrase updated</span>
      </div>
      <div className="tutorial-verble-layer-stack tutorial-verble-phrase-layers">
        <div className="tutorial-verble-phrase-typing"><VerblePhraseExample stage="typing" /></div>
        <div className="tutorial-verble-phrase-feedback"><VerblePhraseExample stage="feedback" /></div>
        <div className="tutorial-verble-phrase-after"><VerblePhraseExample stage="revealed" /></div>
      </div>
      <span className="tutorial-verble-submit-cue"><kbd>Enter</kbd><em>Submit guess</em></span>
      <div className="tutorial-verble-reveal-cue" aria-hidden="true">
        <span /><strong>Yellow I + green T reveal everywhere</strong><span />
      </div>
    </div>
  );
}

function VerbleFullPhraseBoard() {
  return (
    <div className="phrase-layout tutorial-verble-phrase">
      <VerbleTileRow values={["R", "O", "M", "E"]} states={["correct", "correct", "correct", "correct"]} animateReveals={false} />
      <VerbleTileRow
        values={["W", "A", "S", "N", "T"]}
        states={["draft", "draft", "draft", "draft", "correct"]}
        trailingFixed={{ 3: "'" }}
        entryOrder={[0, 1, 2, 3, null]}
      />
      <VerbleTileRow
        values={["B", "U", "I", "L", "T"]}
        states={["draft", "draft", "correct", "draft", "correct"]}
        entryOrder={[4, 5, null, 6, null]}
      />
      <VerbleTileRow values={["I", "N"]} states={["correct", "draft"]} entryOrder={[null, 7]} />
      <VerbleTileRow values={["A"]} states={["draft"]} entryOrder={[8]} />
      <VerbleTileRow values={["D", "A", "Y"]} states={["draft", "draft", "draft"]} entryOrder={[9, 10, 11]} />
    </div>
  );
}

function VerbleFullPhraseFlow() {
  return (
    <div className="tutorial-verble-full-flow tutorial-game-preview" role="img" aria-label="Animated example of completing and submitting the full phrase">
      <div className="tutorial-verble-full-stage">
        <div className="tutorial-verble-full-board">
          <span className="tutorial-verble-step-label">Complete the phrase</span>
          <VerbleFullPhraseBoard />
          <span className="tutorial-verble-full-submit"><kbd>Enter</kbd><em>Submit full phrase</em></span>
        </div>
        <div className="phrase-guess-modal-panel tutorial-phrase-confirm tutorial-verble-confirm-popup">
          <h4 className="result-modal-title phrase-guess-title">Submit full phrase?</h4>
          <p className="result-modal-copy phrase-guess-warning">Warning: a correct phrase wins immediately, but a miss ends the game.</p>
          <div className="phrase-guess-form">
            <p className="phrase-guess-preview">{VERBLE_TUTORIAL.phrase.toUpperCase()}</p>
            <div className="phrase-guess-actions">
              <button className="guess-submit-btn phrase-guess-secondary" type="button" tabIndex={-1}>Keep solving</button>
              <button className="guess-submit-btn" type="button" tabIndex={-1}>Submit phrase</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EquationRow({ values, states = [] }: { values: readonly string[]; states?: readonly TileState[] }) {
  return (
    <div className="board tutorial-equation-board" aria-hidden="true">
      <div className="board-row" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((value, index) => (
          <span className={`board-cell ${states[index] ?? "draft"}`} key={`${value}-${index}`}>
            <span className={value === "×" || value === "÷" ? "equadle-operator-symbol" : undefined}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedbackLegend() {
  return (
    <div className="tutorial-feedback-legend">
      <span><i className="tutorial-swatch tutorial-swatch-correct" />Correct spot</span>
      <span><i className="tutorial-swatch tutorial-swatch-present" />Wrong spot</span>
      <span><i className="tutorial-swatch tutorial-swatch-absent" />Not included</span>
    </div>
  );
}

function PhotoPair({ people = [] }: { people?: TutorialPreviewData["people"] }) {
  if (people.length < 2) return null;

  return (
    <div className="agegaple-duo-grid tutorial-agegaple-duo">
      {people.slice(0, 2).map((person) => (
        <div className="agegaple-person-card" key={`${person.name}-${person.photoYear}`}>
          <div className="agegaple-person-header"><span>{person.name} in {person.photoYear}</span></div>
          <AsyncImage
            className="agegaple-person-image"
            src={person.imageUrl}
            alt={person.imageAlt}
            wrapperClassName="agegaple-person-image-frame"
            overlayClassName="bg-[color:var(--surface-container-lowest)]/80 text-[color:var(--primary-dim)]"
          />
        </div>
      ))}
    </div>
  );
}

type TutorialDoodleSegment = {
  d: string;
  id?: string;
  fullD?: string;
  fillOnly?: boolean;
  style?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
    opacity?: string;
  };
};

const combineTutorialDoodleStages = (revealedCount: number): TutorialDoodleSegment[] => {
  const combined = new Map<string, TutorialDoodleSegment>();
  const stages = DOODLE_TUTORIAL.stages as TutorialDoodleSegment[][];

  for (const stage of stages.slice(0, revealedCount)) {
    for (const segment of stage) {
      const key = segment.id || segment.d;
      const previous = combined.get(key);
      combined.set(key, {
        ...segment,
        d: previous?.d ? `${previous.d} ${segment.d}` : segment.d,
      });
    }
  }

  return Array.from(combined.values());
};

function DoodlePreview() {
  return (
    <div className="doodle-stage-wrap tutorial-doodle-preview" role="img" aria-label="A squirrel doodle being drawn in six stages">
      <svg className="doodle-canvas" viewBox={DOODLE_TUTORIAL.viewBox} aria-hidden="true">
        {DOODLE_TUTORIAL.stages.map((_, stageIndex) => (
          <g className={`tutorial-doodle-stage tutorial-doodle-stage-${stageIndex + 1}`} key={stageIndex}>
            {combineTutorialDoodleStages(stageIndex + 1).map((segment, segmentIndex) => {
              const isFillOnly = segment.fillOnly
                ?? (segment.style?.stroke === "none" && segment.style?.fill !== "none");
              if (!isFillOnly) {
                return (
                  <path
                    d={segment.d}
                    fill="none"
                    key={segment.id || segmentIndex}
                    opacity={segment.style?.opacity || "1"}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={segment.style?.strokeWidth || "3"}
                  />
                );
              }

              const maskId = `tutorial-doodle-stage-${stageIndex}-segment-${segmentIndex}`;
              return (
                <g key={segment.id || segmentIndex}>
                  <defs>
                    <mask id={maskId} maskUnits="userSpaceOnUse">
                      <rect x="-10000" y="-10000" width="20000" height="20000" fill="black" />
                      <path
                        d={segment.d}
                        fill="none"
                        stroke="white"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="18"
                      />
                    </mask>
                  </defs>
                  <path
                    d={segment.fullD || segment.d}
                    fill="currentColor"
                    fillRule="evenodd"
                    mask={`url(#${maskId})`}
                    opacity={segment.style?.opacity || "1"}
                    stroke="none"
                  />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="tutorial-doodle-stage-track" aria-hidden="true">
        {DOODLE_TUTORIAL.stages.map((_, index) => (
          <span className={`tutorial-doodle-stage-dot tutorial-doodle-stage-dot-${index + 1}`} key={index} />
        ))}
      </div>
    </div>
  );
}

function ImagePreview({ game, preview }: { game: "moviedle" | "yeardle"; preview?: TutorialPreviewData["image"] }) {
  if (!preview) return null;
  const isMovie = game === "moviedle";

  return (
    <div className="tutorial-image-preview">
      {preview.title ? <strong className="puzzle-title">{preview.title}</strong> : null}
      <figure className={isMovie ? "still-figure" : "event-figure"}>
        <AsyncImage
          src={preview.url}
          alt={preview.alt}
          className={isMovie ? "still-image" : "event-image"}
          wrapperClassName={isMovie ? "still-image-frame" : "event-image-frame"}
          overlayClassName={isMovie ? "bg-[#f6fffd]/88 text-[color:var(--brand-strong)]" : "bg-[#faf9ff]/88 text-[color:var(--brand-strong)]"}
        />
      </figure>
    </div>
  );
}

function SportleClues({ revealedCount = 1 }: { revealedCount?: number }) {
  const tiles = SPORTLE_TUTORIAL.clues.map((clue, index) => ({ clue, index, isRevealed: index < revealedCount }));
  return (
    <ul className="clues-grid tutorial-sportle-clues" aria-label="Example Sportle clue tiles">
      {tiles.map(({ clue, index, isRevealed }) => (
        <li className={`clue-tile ${isRevealed ? "is-revealed" : "is-locked"}`} key={index}>
          <div className="clue-tile-inner">
            <div className="clue-tile-face clue-tile-front">
              <span className="hint-label">Clue {index + 1}</span>
              <span className="clue-lock-copy">Locked</span>
            </div>
            <div className="clue-tile-face clue-tile-back">
              {isRevealed ? (
                <>
                  <span className="hint-label">{clue.label}</span>
                  {"logoUrl" in clue && clue.logoUrl ? (
                    <div className="clue-team-row">
                      <AsyncImage
                        src={clue.logoUrl}
                        alt={clue.value || "Team logo"}
                        className="team-logo"
                        wrapperClassName="clue-media-frame clue-logo-frame"
                        overlayClassName="clue-image-loading-overlay"
                        spinnerClassName="clue-image-spinner"
                      />
                      <span className="clue-value">{clue.value}</span>
                    </div>
                  ) : <span className="clue-value">{clue.value}</span>}
                </>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function getTutorial(
  game: HowToPlayGame,
  maxGuesses: number,
  equationLength?: number,
  preview?: TutorialPreviewData,
): Tutorial {
  const tutorials: Record<HowToPlayGame, Tutorial> = {
    verble: {
      title: "How to play Verble",
      subtitle: "Solve the daily phrase one word at a time.",
      pages: [
        {
          eyebrow: "Choose a word",
          heading: "Work through the phrase",
          copy: "Select any hidden word, then use the keyboard to guess it. Solved letters also appear in matching spots across the phrase.",
          visual: (
            <div className="phrase-layout tutorial-game-preview tutorial-verble-phrase">
              <VerbleTileRow values={["R", "O", "M", "E"]} states={["correct", "correct", "correct", "correct"]} />
              <VerbleTileRow values={["", "", "", "", ""]} selected trailingFixed={{ 3: "'" }} />
              <VerbleTileRow values={["", "", "", "", ""]} />
              <VerbleTileRow values={["", ""]} />
              <VerbleTileRow values={[""]} />
              <VerbleTileRow values={["", "", ""]} />
            </div>
          ),
        },
        {
          eyebrow: "Reveal matching letters",
          heading: "One guess helps the whole phrase",
          copy: "After ADMIT is guessed for BUILT, the yellow I and green T reveal every matching spot in the phrase. Gray letters do not reveal.",
          visual: <VerbleGuessFlow />,
        },
        {
          eyebrow: "Finish the phrase",
          heading: "Submit the full phrase",
          copy: `Fill every remaining tile, then press Enter to review the full phrase. Confirm carefully: an incorrect phrase ends the game, even if you have guesses left.`,
          visual: <VerbleFullPhraseFlow />,
        },
      ],
    },
    agegaple: {
      title: "How to play Agegaple",
      subtitle: "Estimate the age gap between two people.",
      pages: [
        {
          eyebrow: "Study the pair",
          heading: "Guess their age gap",
          copy: "Compare the two people and estimate how many years apart they are. Keep each photo's year in mind, since the pictures may have been taken at different times.",
          visual: <PhotoPair people={preview?.people} />,
        },
        {
          eyebrow: "Make a guess",
          heading: "Enter the age gap",
          copy: "Submit the number of years you think separates their ages. The answer is rounded to the nearest whole year.",
          visual: (
            <div className="tutorial-agegaple-controls tutorial-game-preview">
              <input type="range" min="0" max="80" value="12" readOnly aria-label="Example age gap slider" />
              <input className="agegaple-guess-input" type="number" value="12" readOnly aria-label="Example age gap guess" />
              <span>years</span>
            </div>
          ),
        },
        {
          eyebrow: "Follow the temperature",
          heading: `Find it in ${maxGuesses} guesses`,
          copy: "After a miss, the temperature and direction show whether you are close and whether the real gap is higher or lower.",
          visual: (
            <div className="tutorial-game-feedback">
              <div className="temperature-hint-wrap">
                <p className="temperature-hint-heat">Very warm 🔥</p>
                <p className="temperature-hint-trend">Guess higher</p>
              </div>
              <div className="guess-history-latest"><span className="guess-history-guess">11 years</span><strong className="guess-history-status-wrong">Wrong</strong></div>
            </div>
          ),
        },
      ],
    },
    doodle: {
      title: "How to play Doodle",
      subtitle: "Identify the picture as it is drawn.",
      pages: [
        {
          eyebrow: "Watch closely",
          heading: "The drawing starts simple",
          copy: "The doodle appears in stages. Use the first few lines, shapes, and details to work out what is being drawn.",
          visual: <DoodlePreview />,
        },
        {
          eyebrow: "Name the picture",
          heading: "Guess at any stage",
          copy: "Type what you think the doodle represents. A wrong answer reveals the next part of the drawing.",
          visual: (
            <div className="guess-form tutorial-guess-form tutorial-game-preview">
              <input className="guess-input" value={DOODLE_TUTORIAL.answer} readOnly aria-label="Example doodle guess" />
              <button className="guess-submit-btn" type="button" disabled>Guess</button>
            </div>
          ),
        },
        {
          eyebrow: "Use each reveal",
          heading: `Solve it in ${maxGuesses} guesses`,
          copy: "Every miss costs a guess but adds more detail. Earlier correct answers earn the strongest result.",
          visual: (
            <div className="tutorial-progress" aria-label={`${Math.max(0, maxGuesses - 2)} guesses left`}>
              {Array.from({ length: maxGuesses }, (_, index) => (
                <span className={index >= 2 ? "is-remaining" : undefined} key={index} />
              ))}
            </div>
          ),
        },
      ],
    },
    equadle: {
      title: "How to play Equadle",
      subtitle: "Build the hidden expression for the target.",
      pages: [
        {
          eyebrow: "Hit the target",
          heading: "Complete the left side",
          copy: `The answer is shown after the equals sign. Use digits and +, -, ×, or ÷ to build a ${equationLength ?? "nine"}-tile equation that equals that target.`,
          visual: <div className="tutorial-game-preview"><EquationRow values={EQUADLE_TUTORIAL.answer} /></div>,
        },
        {
          eyebrow: "Read the colors",
          heading: "Narrow down every tile",
          copy: "Green is correct, yellow appears elsewhere in the equation, and gray is not part of the hidden equation.",
          visual: (
            <div className="tutorial-visual-stack">
              <div className="tutorial-game-preview">
                <EquationRow values={EQUADLE_TUTORIAL.incorrectGuess} states={EQUADLE_TUTORIAL.incorrectGuessFeedback} />
              </div>
              <FeedbackLegend />
            </div>
          ),
        },
        {
          eyebrow: "Check the math",
          heading: `Solve it in ${maxGuesses} guesses`,
          copy: "Standard PEMDAS order applies: multiplication and division happen before addition and subtraction. Repeated digits and symbols are allowed.",
          visual: (
            <div className="tutorial-math-order">
              <span>2 + <b>3 × 4</b></span><span>2 + 12</span><strong>= 14</strong>
            </div>
          ),
        },
      ],
    },
    moviedle: {
      title: "How to play Moviedle",
      subtitle: "Identify the movie from its stills.",
      pages: [
        {
          eyebrow: "Study the first still",
          heading: "Look for visual clues",
          copy: "Use the setting, costumes, actors, and cinematography in the first image to identify the movie.",
          visual: <ImagePreview game="moviedle" preview={preview?.image} />,
        },
        {
          eyebrow: "Choose an exact title",
          heading: "Search, then select",
          copy: "Start typing and choose the movie from the suggestions. Selecting the exact title avoids ambiguity between similar names.",
          visual: (
            <div className="tutorial-movie-search tutorial-game-preview">
              <div className="guess-form tutorial-guess-form"><input className="guess-input" value="The Secret" readOnly aria-label="Example movie search" /><button className="guess-submit-btn" type="button" disabled>Guess</button></div>
              <div className="suggestions-wrap"><button className="suggestion-item" type="button">The Secret Garden</button></div>
            </div>
          ),
        },
        {
          eyebrow: "Reveal more evidence",
          heading: `Find it in ${maxGuesses} guesses`,
          copy: "Each wrong guess unlocks another still. Combine the new image with everything you have already seen.",
          visual: (
            <div className="tutorial-reveal-strip">
              <span className="is-visible">Still 1</span><span className="is-visible">Still 2</span><span>Still 3</span>
            </div>
          ),
        },
      ],
    },
    sportle: {
      title: "How to play Sportle",
      subtitle: "Identify the professional athlete.",
      pages: [
        {
          eyebrow: "Start with one clue",
          heading: "Guess any athlete",
          copy: "Use the opening team clue to make your first guess. Search for a name and select the exact athlete from the suggestions.",
          visual: <SportleClues />,
        },
        {
          eyebrow: "Unlock more clues",
          heading: "Learn from every miss",
          copy: "A wrong guess flips over another clue tile. New facts such as position, number, college, or country help narrow the field.",
          visual: (
            <SportleClues revealedCount={3} />
          ),
        },
        {
          eyebrow: "Stack the evidence",
          heading: `Find them in ${maxGuesses} guesses`,
          copy: "Each miss reveals another clue. Revisit all visible clues together before choosing your next athlete.",
          visual: <div className="tutorial-game-preview guess-form tutorial-guess-form"><input className="guess-input" value={SPORTLE_TUTORIAL.answer} readOnly aria-label="Example athlete guess" /><button className="guess-submit-btn" type="button" disabled>Guess</button></div>,
        },
      ],
    },
    yeardle: {
      title: "How to play Yeardle",
      subtitle: "Date an event from this day in history.",
      pages: [
        {
          eyebrow: "Read the event",
          heading: "Look for time-period clues",
          copy: "Study the image and event description. Names, technology, clothing, and historical context can all point toward a year.",
          visual: <ImagePreview game="yeardle" preview={preview?.image} />,
        },
        {
          eyebrow: "Enter a four-digit year",
          heading: "Use warmer and colder hints",
          copy: "After each guess, the feedback shows how close you are and whether the correct year is earlier or later.",
          visual: (
            <div className="tutorial-game-feedback tutorial-game-preview">
              <div className="guess-form tutorial-guess-form"><input className="guess-input" value="1980" readOnly aria-label="Example year guess" /><button className="guess-submit-btn" type="button" disabled>Guess</button></div>
              <div className="temperature-hint-wrap"><p className="temperature-hint-heat">Warm ☀️</p><p className="temperature-hint-trend">Guess later</p></div>
            </div>
          ),
        },
        {
          eyebrow: "Narrow the timeline",
          heading: `Find the year in ${maxGuesses} guesses`,
          copy: "Use the distance and direction from every prior guess. The exact year wins the game.",
          visual: <div className="tutorial-timeline"><span>1980</span><i /><strong>1992</strong><i /><span>1995</span></div>,
        },
      ],
    },
  };

  return tutorials[game];
}

export default function HowToPlayDialog({
  game,
  maxGuesses,
  equationLength,
  preview,
  onClose,
}: HowToPlayDialogProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const tutorial = getTutorial(game, maxGuesses, equationLength, preview);
  const page = tutorial.pages[pageIndex];
  const isLastPage = pageIndex === tutorial.pages.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPageIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setPageIndex((current) => Math.min(tutorial.pages.length - 1, current + 1));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, tutorial.pages.length]);

  return (
    <div className="result-modal-backdrop" onClick={onClose}>
      <section
        className={`result-modal-panel how-to-play-modal-panel tutorial-${game}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        aria-describedby="how-to-play-subtitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="result-modal-close" type="button" onClick={onClose} aria-label="Close how to play dialog">
          ×
        </button>
        <header className="tutorial-header">
          <h2 className="result-modal-title how-to-play-title" id="how-to-play-title">{tutorial.title}</h2>
          <p className="how-to-play-subtitle" id="how-to-play-subtitle">{tutorial.subtitle}</p>
        </header>

        <div className="tutorial-page" key={pageIndex}>
          <div className="tutorial-copy">
            <span className="tutorial-eyebrow">{page.eyebrow}</span>
            <h3>{page.heading}</h3>
            <p>{page.copy}</p>
          </div>
          <div className="tutorial-visual">{page.visual}</div>
        </div>

        <footer className="tutorial-footer">
          <div className="tutorial-pagination" aria-label="Tutorial pages">
            {tutorial.pages.map((item, index) => (
              <button
                aria-label={`View ${item.eyebrow}`}
                aria-current={index === pageIndex ? "step" : undefined}
                className={index === pageIndex ? "is-active" : ""}
                key={item.eyebrow}
                onClick={() => setPageIndex(index)}
                type="button"
              />
            ))}
          </div>
          <span className="tutorial-page-count">{pageIndex + 1} of {tutorial.pages.length}</span>
          <div className="tutorial-actions">
            {pageIndex > 0 ? (
              <button className="tutorial-back-btn" type="button" onClick={() => setPageIndex((current) => current - 1)}>
                Back
              </button>
            ) : null}
            <button
              className="tutorial-next-btn"
              type="button"
              onClick={() => isLastPage ? onClose() : setPageIndex((current) => current + 1)}
            >
              {isLastPage ? "Start playing" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
