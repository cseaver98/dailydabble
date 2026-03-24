const challengeDateEl = document.getElementById("challengeDate");
const hintsListEl = document.getElementById("hintsList");
const guessButtonsEl = document.getElementById("guessButtons");
const messageEl = document.getElementById("message");
const archiveListEl = document.getElementById("archiveList");
const currentStreakEl = document.getElementById("currentStreak");
const bestStreakEl = document.getElementById("bestStreak");
const todayGameBtn = document.getElementById("todayGameBtn");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const navMenuEl = document.getElementById("navMenu");
const photoDialogEl = document.getElementById("photoDialog");
const photoDialogImageEl = document.getElementById("photoDialogImage");
const photoDialogCaptionEl = document.getElementById("photoDialogCaption");
const photoDialogCloseBtn = document.getElementById("photoDialogCloseBtn");
const photoDialogPrevBtn = document.getElementById("photoDialogPrevBtn");
const photoDialogNextBtn = document.getElementById("photoDialogNextBtn");
const resultsDialogEl = document.getElementById("resultsDialog");
const resultsDialogCloseBtn = document.getElementById("resultsDialogCloseBtn");
const resultsTitleEl = document.getElementById("resultsTitle");
const resultsMapEl = document.getElementById("resultsMap");
const resultsSummaryEl = document.getElementById("resultsSummary");
const resultsBusinessNameEl = document.getElementById("resultsBusinessName");
const resultsBusinessMetaEl = document.getElementById("resultsBusinessMeta");
const resultsGuessHistoryEl = document.getElementById("resultsGuessHistory");
const resultsYelpLinkEl = document.getElementById("resultsYelpLink");
const resultsShareBtn = document.getElementById("resultsShareBtn");
const resultsShareStatusEl = document.getElementById("resultsShareStatus");
const nextGameTimerEl = document.getElementById("nextGameTimer");
const resultsNextGameTimerEl = document.getElementById("resultsNextGameTimer");

let activeChallenge = null;
let revealedHints = 1;
let activeHintIndex = 0;
let gameLocked = false;
let selectedGuessRating = null;
let dialogPhotoItems = [];
let dialogPhotoIndex = 0;
let wrongGuessCount = 0;
let totalGuessCount = 0;
let lastResultPayload = null;
let guessHistory = [];
let isReplayMode = false;
let nextGameTimerIntervalId = null;

const STORAGE_KEY = "yelple-streak-v1";
const PROGRESS_STORAGE_KEY = "yelple-progress-v1";
const TOTAL_HINTS = 3;
const MAX_WRONG_GUESSES = 3;

function getStreakState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastWinDate: null,
      wonDates: {}
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastWinDate: null,
      wonDates: {}
    };
  }
}

function saveStreakState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getProgressStore() {
  const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) {
    return { byDate: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.byDate !== "object") {
      return { byDate: {} };
    }
    return parsed;
  } catch {
    return { byDate: {} };
  }
}

function saveProgressStore(store) {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
}

function normalizeProgress(progress) {
  if (!progress || typeof progress !== "object") return null;

  const revealed = Number(progress.revealedHints);
  const hintIndex = Number(progress.activeHintIndex);
  const wrong = Number(progress.wrongGuessCount);
  const total = Number(progress.totalGuessCount);
  const selected = typeof progress.selectedGuessRating === "number"
    ? progress.selectedGuessRating
    : null;
  const guessHistory = Array.isArray(progress.guessHistory)
    ? progress.guessHistory
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const guess = Number(entry.guess);
          if (!Number.isFinite(guess)) return null;
          const actual = Number(entry.actual);
          return {
            guess: Number(guess.toFixed(1)),
            actual: Number.isFinite(actual) ? Number(actual.toFixed(1)) : null
          };
        })
        .filter(Boolean)
    : [];

  return {
    revealedHints: Number.isFinite(revealed) ? Math.max(1, Math.min(TOTAL_HINTS, Math.floor(revealed))) : 1,
    activeHintIndex: Number.isFinite(hintIndex) ? Math.max(0, Math.floor(hintIndex)) : 0,
    gameLocked: Boolean(progress.gameLocked),
    selectedGuessRating: selected,
    wrongGuessCount: Number.isFinite(wrong) ? Math.max(0, Math.floor(wrong)) : 0,
    totalGuessCount: Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0,
    lastResultPayload: progress.lastResultPayload || null,
    guessHistory
  };
}

function loadProgress(challengeDate) {
  if (!challengeDate) return null;
  const store = getProgressStore();
  return normalizeProgress(store.byDate?.[challengeDate] ?? null);
}

function saveProgress(challengeDate) {
  if (!challengeDate || !activeChallenge || activeChallenge.challengeDate !== challengeDate) return;
  if (isReplayMode) return;

  const store = getProgressStore();
  const byDate = store.byDate || {};
  byDate[challengeDate] = {
    revealedHints,
    activeHintIndex,
    gameLocked,
    selectedGuessRating: typeof selectedGuessRating === "number" ? selectedGuessRating : null,
    wrongGuessCount,
    totalGuessCount,
    lastResultPayload,
    guessHistory
  };

  const sortedDates = Object.keys(byDate).sort();
  while (sortedDates.length > 60) {
    const oldestDate = sortedDates.shift();
    if (oldestDate) {
      delete byDate[oldestDate];
    }
  }

  saveProgressStore({ byDate });
}

function renderStreak() {
  if (!currentStreakEl || !bestStreakEl) return;
  const streak = getStreakState();
  currentStreakEl.textContent = String(streak.currentStreak || 0);
  bestStreakEl.textContent = String(streak.bestStreak || 0);
}

function dateDiffInDays(a, b) {
  const aDate = new Date(`${a}T00:00:00Z`);
  const bDate = new Date(`${b}T00:00:00Z`);
  const ms = bDate.getTime() - aDate.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function markWin(challengeDate) {
  const streak = getStreakState();
  if (streak.wonDates[challengeDate]) {
    return;
  }

  if (streak.lastWinDate) {
    const dayGap = dateDiffInDays(streak.lastWinDate, challengeDate);
    if (dayGap === 1) {
      streak.currentStreak += 1;
    } else {
      streak.currentStreak = 1;
    }
  } else {
    streak.currentStreak = 1;
  }

  streak.bestStreak = Math.max(streak.bestStreak || 0, streak.currentStreak);
  streak.lastWinDate = challengeDate;
  streak.wonDates[challengeDate] = true;

  saveStreakState(streak);
  renderStreak();
}

function setMessage(text, kind = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${kind}`.trim();
}

function setReplayMode(isReplay) {
  isReplayMode = Boolean(isReplay);
  if (todayGameBtn) {
    todayGameBtn.hidden = !isReplay;
  }
  syncNextGameTimerVisibility();
}

function formatCountdown(msRemaining) {
  const safeMs = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getTimeUntilNextLocalMidnightMs() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
}

function updateNextGameTimerText() {
  const shouldShow = gameLocked && !isReplayMode;
  if (!shouldShow) {
    return;
  }

  const text = `Next game in ${formatCountdown(getTimeUntilNextLocalMidnightMs())}`;
  if (nextGameTimerEl) {
    nextGameTimerEl.textContent = text;
  }
  if (resultsNextGameTimerEl) {
    resultsNextGameTimerEl.textContent = text;
  }
}

function stopNextGameTimer() {
  if (nextGameTimerIntervalId) {
    window.clearInterval(nextGameTimerIntervalId);
    nextGameTimerIntervalId = null;
  }
}

function startNextGameTimer() {
  stopNextGameTimer();
  updateNextGameTimerText();
  nextGameTimerIntervalId = window.setInterval(updateNextGameTimerText, 1000);
}

function syncNextGameTimerVisibility() {
  const shouldShow = gameLocked && !isReplayMode;
  if (nextGameTimerEl) {
    nextGameTimerEl.hidden = !shouldShow;
  }
  if (resultsNextGameTimerEl) {
    resultsNextGameTimerEl.hidden = !shouldShow;
  }

  if (shouldShow) {
    startNextGameTimer();
  } else {
    stopNextGameTimer();
  }
}

function closeNavMenu() {
  if (!navMenuEl || !menuToggleBtn) return;
  navMenuEl.hidden = true;
  menuToggleBtn.setAttribute("aria-expanded", "false");
}

function openNavMenu() {
  if (!navMenuEl || !menuToggleBtn) return;
  navMenuEl.hidden = false;
  menuToggleBtn.setAttribute("aria-expanded", "true");
}

function toggleNavMenu() {
  if (!navMenuEl) return;
  if (navMenuEl.hidden) {
    openNavMenu();
  } else {
    closeNavMenu();
  }
}

function setupNavMenu() {
  if (!navMenuEl || !menuToggleBtn) return;
  if (menuToggleBtn.dataset.ddMenuManaged === "react" || navMenuEl.dataset.ddMenuManaged === "react") {
    return;
  }
  closeNavMenu();

  menuToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNavMenu();
  });

  document.addEventListener("click", (event) => {
    if (navMenuEl.hidden) return;
    if (navMenuEl.contains(event.target) || menuToggleBtn.contains(event.target)) return;
    closeNavMenu();
  });

  navMenuEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavMenu();
    }
  });
}

function getHintBundle() {
  if (!activeChallenge?.hints) {
    return {
      reviews: [],
      photos: []
    };
  }

  const reviews = Array.isArray(activeChallenge.hints.reviews)
    ? activeChallenge.hints.reviews.slice(0, 3)
    : [activeChallenge.hints.hint1, activeChallenge.hints.hint2, activeChallenge.hints.hint3]
        .filter(Boolean)
        .map((text) => ({ text, rating: null, author: "Unknown", date: null }));

  while (reviews.length < 3) {
    reviews.push({
      text: "Additional clue unavailable.",
      rating: null,
      author: "Yelple",
      date: null
    });
  }

  const photos = Array.isArray(activeChallenge.hints.photos)
    ? activeChallenge.hints.photos.slice(0, 3)
    : [];

  return { reviews, photos };
}

function formatReviewDate(rawDate) {
  if (!rawDate) return null;
  const value = new Date(rawDate);
  if (Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getYelpStarState(rating, index) {
  if (typeof rating !== "number") return "empty";
  const normalized = Math.max(0, Math.min(5, Math.round(rating * 2) / 2));
  const remaining = normalized - index;
  if (remaining >= 1) return "full";
  if (remaining >= 0.5) return "half";
  return "empty";
}

function buildYelpStars(rating) {
  const wrapper = document.createElement("div");
  wrapper.className = "yelp-stars";
  wrapper.setAttribute("aria-label", typeof rating === "number" ? `${rating.toFixed(1)} out of 5 stars` : "No rating");

  for (let i = 0; i < 5; i += 1) {
    const starBox = document.createElement("span");
    starBox.className = `yelp-star-box ${getYelpStarState(rating, i)}`;
    starBox.textContent = "★";
    wrapper.appendChild(starBox);
  }

  return wrapper;
}

function buildReviewerAvatar(review) {
  const avatar = document.createElement("div");
  avatar.className = "review-avatar";
  const fallback = (review.author || "Y")[0]?.toUpperCase() || "Y";
  avatar.textContent = fallback;
  return avatar;
}

function getRevealedPhotoItems() {
  if (!activeChallenge?.hints) return [];

  const { reviews, photos } = getHintBundle();
  const reviewHints = [
    { review: reviews[0], photo: photos[0] || null, hintIndex: 0 },
    { review: reviews[1], photo: photos[1] || null, hintIndex: 1 },
    { review: reviews[2], photo: photos[2] || null, hintIndex: 2 }
  ];

  const revealedCount = Math.max(1, Math.min(revealedHints, reviewHints.length));
  return reviewHints.slice(0, revealedCount).filter((item) => item.photo?.url);
}

function renderDialogPhoto() {
  if (!photoDialogImageEl || !photoDialogCaptionEl || !dialogPhotoItems.length) return;

  const item = dialogPhotoItems[dialogPhotoIndex];
  photoDialogImageEl.src = item.photo.url;
  photoDialogImageEl.alt = item.photo.alt || "Expanded review photo";

  const captionParts = [];
  if (item.review?.author) captionParts.push(item.review.author);
  if (activeChallenge?.business?.city && activeChallenge?.business?.state) {
    captionParts.push(`${activeChallenge.business.city}, ${activeChallenge.business.state}`);
  }
  captionParts.push(`Photo ${dialogPhotoIndex + 1} of ${dialogPhotoItems.length}`);
  photoDialogCaptionEl.textContent = captionParts.join(" • ");

  if (photoDialogPrevBtn) {
    photoDialogPrevBtn.disabled = dialogPhotoIndex <= 0;
  }
  if (photoDialogNextBtn) {
    photoDialogNextBtn.disabled = dialogPhotoIndex >= dialogPhotoItems.length - 1;
  }
}

function stepDialogPhoto(direction) {
  if (!dialogPhotoItems.length) return;
  const nextIndex = dialogPhotoIndex + direction;
  dialogPhotoIndex = Math.max(0, Math.min(nextIndex, dialogPhotoItems.length - 1));
  renderDialogPhoto();
}

function openPhotoDialog(hintIndex) {
  if (!photoDialogEl || !photoDialogImageEl) return;

  dialogPhotoItems = getRevealedPhotoItems();
  if (!dialogPhotoItems.length) return;

  const preferredIndex = dialogPhotoItems.findIndex((item) => item.hintIndex === hintIndex);
  dialogPhotoIndex = preferredIndex >= 0 ? preferredIndex : 0;
  renderDialogPhoto();
  photoDialogEl.showModal();
}

function setupPhotoDialog() {
  if (!photoDialogEl || !photoDialogCloseBtn) return;

  photoDialogCloseBtn.addEventListener("click", () => {
    photoDialogEl.close();
  });

  if (photoDialogPrevBtn) {
    photoDialogPrevBtn.addEventListener("click", () => {
      stepDialogPhoto(-1);
    });
  }

  if (photoDialogNextBtn) {
    photoDialogNextBtn.addEventListener("click", () => {
      stepDialogPhoto(1);
    });
  }

  photoDialogEl.addEventListener("click", (event) => {
    if (event.target === photoDialogEl) {
      photoDialogEl.close();
    }
  });

  photoDialogEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepDialogPhoto(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepDialogPhoto(1);
    }
  });
}

function closeResultsDialog() {
  if (resultsDialogEl?.open) {
    resultsDialogEl.close();
  }
}

function setResultsShareStatus(text) {
  if (!resultsShareStatusEl) return;
  resultsShareStatusEl.textContent = text || "";
}

function buildResultsSharePayload({ won, answer, actualRating }) {
  const shareBlocks = guessHistory.map((entry) => {
    const actual = Number.isFinite(entry.actual) ? entry.actual : Number(actualRating);
    const delta = Math.abs(Number((entry.guess - actual).toFixed(1)));
    if (delta <= 0.1) return "🟩";
    if (delta <= 0.3) return "🟨";
    if (delta <= 0.6) return "🟧";
    return "🟥";
  }).join("");
  const gameDate = activeChallenge?.challengeDate || "Today";
  const shareUrl = isReplayMode && activeChallenge?.challengeDate
    ? `${window.location.origin}/?replay=${encodeURIComponent(activeChallenge.challengeDate)}`
    : `${window.location.origin}/`;
  const text = [
    `${answer.name || "Today's business"}`,
    `${totalGuessCount}/${MAX_WRONG_GUESSES} guesses`,
    shareBlocks || "⬜",
    shareUrl,
  ].join("\n");
  return {
    title: "Yelple",
    text
  };
}

async function handleResultsShare() {
  if (!lastResultPayload) return;
  const payload = buildResultsSharePayload(lastResultPayload);
  setResultsShareStatus("");

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      setResultsShareStatus("Shared");
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(payload.text);
      setResultsShareStatus("Share link copied");
      return;
    } catch {
      // fall through
    }
  }

  setResultsShareStatus("Share not available on this device");
}

function openResultsDialog({ won, answer, actualRating }) {
  if (!resultsDialogEl || !resultsTitleEl || !resultsMapEl || !resultsBusinessNameEl || !resultsBusinessMetaEl || !answer) {
    return;
  }

  resultsTitleEl.textContent = won ? "You got it right!" : "Game over";
  resultsBusinessNameEl.textContent = answer.name || "Unknown Business";
  const cityState = [answer.city, answer.state].filter(Boolean).join(", ");
  resultsBusinessMetaEl.textContent = `${cityState || "Unknown location"} • ${Number(actualRating).toFixed(1)} stars`;
  if (resultsSummaryEl) {
    resultsSummaryEl.textContent = won
      ? `Solved in ${totalGuessCount} guess${totalGuessCount === 1 ? "" : "es"}.`
      : `Used ${totalGuessCount} guesses.`;
  }
  if (resultsShareBtn) {
    resultsShareBtn.disabled = false;
  }
  setResultsShareStatus("");

  if (resultsGuessHistoryEl) {
    resultsGuessHistoryEl.innerHTML = "";
    const normalizedActual = Number(actualRating);
    if (guessHistory.length) {
      guessHistory.forEach((entry, index) => {
        const row = document.createElement("li");
        row.className = "results-guess-history-item";

        const left = document.createElement("span");
        left.className = "results-guess-history-label";
        left.textContent = `Guess ${index + 1}: ${entry.guess.toFixed(1)}`;

        const right = document.createElement("span");
        const actual = Number.isFinite(entry.actual) ? entry.actual : normalizedActual;
        const delta = Number((entry.guess - actual).toFixed(1));
        if (Math.abs(delta) <= 0.05) {
          right.className = "results-guess-history-status ok";
          right.textContent = "Correct";
        } else if (delta > 0) {
          right.className = "results-guess-history-status high";
          right.textContent = "Too high";
        } else {
          right.className = "results-guess-history-status low";
          right.textContent = "Too low";
        }

        row.append(left, right);
        resultsGuessHistoryEl.appendChild(row);
      });
    } else {
      const empty = document.createElement("li");
      empty.className = "results-guess-history-empty";
      empty.textContent = "No guesses recorded.";
      resultsGuessHistoryEl.appendChild(empty);
    }
  }

  const query = encodeURIComponent(`${answer.name || ""} ${answer.city || ""} ${answer.state || ""}`.trim());
  resultsMapEl.src = `https://maps.google.com/maps?q=${query}&output=embed`;

  if (resultsYelpLinkEl) {
    if (answer.yelpUrl) {
      resultsYelpLinkEl.href = answer.yelpUrl;
      resultsYelpLinkEl.hidden = false;
    } else {
      resultsYelpLinkEl.hidden = true;
    }
  }

  updateNextGameTimerText();
  resultsDialogEl.showModal();
}

function setupResultsDialog() {
  if (!resultsDialogEl || !resultsDialogCloseBtn) return;

  resultsDialogCloseBtn.addEventListener("click", () => {
    resultsDialogEl.close();
  });

  resultsDialogEl.addEventListener("click", (event) => {
    if (event.target === resultsDialogEl) {
      resultsDialogEl.close();
    }
  });

  if (resultsShareBtn) {
    resultsShareBtn.addEventListener("click", () => {
      void handleResultsShare();
    });
  }
}

function buildHintCard(hint, index, revealedCount) {
  const card = document.createElement("article");
  card.className = "hint-card";
  card.dataset.index = String(index);

  if (hint.kind === "review") {
    card.classList.add("hint-card-has-photo");
    const layout = document.createElement("div");
    layout.className = "hint-card-layout";

    const mediaPanel = document.createElement("div");
    mediaPanel.className = "hint-media-panel";

    if (hint.photo?.url) {
      const image = document.createElement("img");
      image.className = "hint-card-photo hint-card-photo-zoomable";
      image.src = hint.photo.url;
      image.alt = hint.photo.alt || "Business hint photo";
      image.loading = "lazy";
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", "Open expanded photo");
      image.addEventListener("click", () => openPhotoDialog(index));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPhotoDialog(index);
        }
      });
      mediaPanel.appendChild(image);

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "hint-card-nav hint-card-nav-prev";
      prevBtn.setAttribute("aria-label", "Previous review");
      prevBtn.textContent = "←";
      prevBtn.disabled = activeHintIndex <= 0;
      prevBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        activeHintIndex = Math.max(0, activeHintIndex - 1);
        renderHints();
      });

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "hint-card-nav hint-card-nav-next";
      nextBtn.setAttribute("aria-label", "Next review");
      nextBtn.textContent = "→";
      nextBtn.disabled = activeHintIndex >= revealedCount - 1;
      nextBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        activeHintIndex += 1;
        renderHints();
      });

      mediaPanel.append(prevBtn, nextBtn);
    } else {
      const noPhoto = document.createElement("p");
      noPhoto.className = "hint-card-meta";
      noPhoto.textContent = "No photo available for this review.";
      mediaPanel.appendChild(noPhoto);
    }

    layout.appendChild(mediaPanel);

    const summary = document.createElement("div");
    summary.className = "review-summary-row";

    const summaryMeta = document.createElement("div");
    summaryMeta.className = "review-summary-meta";

    const avatar = buildReviewerAvatar(hint.review);
    avatar.classList.add("review-avatar-small");

    const author = document.createElement("p");
    author.className = "review-footer-author";
    author.textContent = hint.review.author || `Reviewer ${index + 1}`;

    summaryMeta.append(avatar, author);

    const summaryRight = document.createElement("div");
    summaryRight.className = "review-summary-right";
    summaryRight.appendChild(buildYelpStars(hint.review.rating));

    const summaryText = document.createElement("p");
    summaryText.className = "review-summary-text";
    summaryText.textContent = hint.review.text;

    summary.append(summaryMeta, summaryText, summaryRight);

    card.append(layout, summary);
  }

  return card;
}

function renderHints() {
  hintsListEl.innerHTML = "";

  if (!activeChallenge?.hints) {
    const card = document.createElement("article");
    card.className = "hint-card hint-card-muted";
    card.textContent = "Review content expired. Use replay from archive to refresh this date.";
    hintsListEl.appendChild(card);
    return;
  }

  const { reviews, photos } = getHintBundle();
  const hints = [
    { kind: "review", review: reviews[0], photo: photos[0] || null },
    { kind: "review", review: reviews[1], photo: photos[1] || null },
    { kind: "review", review: reviews[2], photo: photos[2] || null }
  ];

  const revealedCount = Math.max(1, Math.min(revealedHints, TOTAL_HINTS));
  activeHintIndex = Math.max(0, Math.min(activeHintIndex, revealedCount - 1));
  const hiddenCount = hints.length - revealedCount;

  if (hiddenCount > 0) {
    const hidden = document.createElement("p");
    hidden.className = "hint-hidden-note subtle";
    hidden.textContent = `${hiddenCount} hidden clue${hiddenCount === 1 ? "" : "s"} remaining`;
    hintsListEl.appendChild(hidden);
  }

  const contextBar = document.createElement("div");
  contextBar.className = "hint-context";

  const category = document.createElement("p");
  category.className = "hint-chip";
  category.textContent = `Category: ${activeChallenge.business.category}`;

  const location = document.createElement("p");
  location.className = "hint-chip";
  location.textContent = `Location: ${activeChallenge.business.city}, ${activeChallenge.business.state}`;

  contextBar.append(category, location);
  hintsListEl.appendChild(contextBar);

  const activeCard = buildHintCard(hints[activeHintIndex], activeHintIndex, revealedCount);
  activeCard.classList.add("hint-single-card");
  hintsListEl.appendChild(activeCard);
}

async function submitGuess(guessedRating) {
  if (!activeChallenge || gameLocked) return;

  const response = await fetch("/api/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeDate: activeChallenge.challengeDate,
      guessedRating
    })
  });

  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error || "Could not submit guess.", "warn");
    return;
  }
  totalGuessCount += 1;
  guessHistory.push({
    guess: Number(guessedRating.toFixed(1)),
    actual: Number(Number(data.actualRating).toFixed(1))
  });

  if (data.isCorrect) {
    gameLocked = true;
    selectedGuessRating = guessedRating;
    revealedHints = TOTAL_HINTS;
    activeHintIndex = 0;
    lastResultPayload = {
      won: true,
      answer: data.answer,
      actualRating: data.actualRating
    };
    if (!isReplayMode) {
      markWin(activeChallenge.challengeDate);
    }
    renderHints();
    renderGuessButtons();
    setMessage(
      `Correct! ${data.answer.name} in ${data.answer.city}, ${data.answer.state} is ${data.actualRating.toFixed(1)} stars.`,
      "ok"
    );
    saveProgress(activeChallenge.challengeDate);
    openResultsDialog(lastResultPayload);
  } else {
    const actualRating = Number(data.actualRating);
    const direction = guessedRating > actualRating ? "Too high." : "Too low.";
    wrongGuessCount += 1;

    if (wrongGuessCount >= MAX_WRONG_GUESSES) {
      gameLocked = true;
      revealedHints = TOTAL_HINTS;
      activeHintIndex = 0;
      lastResultPayload = {
        won: false,
        answer: data.answer,
        actualRating: actualRating
      };
      renderHints();
      renderGuessButtons();
      setMessage(`Out of guesses. ${data.answer.name} is ${actualRating.toFixed(1)} stars.`, "warn");
      saveProgress(activeChallenge.challengeDate);
      openResultsDialog(lastResultPayload);
      return;
    }

    if (revealedHints < TOTAL_HINTS) {
      revealedHints += 1;
      activeHintIndex = Math.min(revealedHints - 1, TOTAL_HINTS - 1);
      renderHints();
    }

    const remaining = MAX_WRONG_GUESSES - wrongGuessCount;
    setMessage(`${direction} ${remaining} guess${remaining === 1 ? "" : "es"} left.`, "warn");
    saveProgress(activeChallenge.challengeDate);
  }
}

function renderGuessButtons() {
  guessButtonsEl.innerHTML = "";

  const picker = document.createElement("div");
  picker.className = "guess-picker";

  const stars = document.createElement("div");
  stars.className = "guess-stars yelp-stars";
  stars.setAttribute("role", "slider");
  stars.setAttribute("aria-label", "Guess the business star rating from 1.0 to 5.0");
  stars.setAttribute("aria-valuemin", "1");
  stars.setAttribute("aria-valuemax", "5");
  stars.setAttribute("aria-valuenow", typeof selectedGuessRating === "number" ? selectedGuessRating.toFixed(1) : "1.0");
  stars.tabIndex = 0;

  const valueLabel = document.createElement("p");
  valueLabel.className = "guess-value";
  const guessLeftGroup = document.createElement("div");
  guessLeftGroup.className = "guess-left-group";
  const stepper = document.createElement("div");
  stepper.className = "guess-stepper";
  const decrementBtn = document.createElement("button");
  decrementBtn.type = "button";
  decrementBtn.className = "guess-step-btn";
  decrementBtn.textContent = "−";
  decrementBtn.setAttribute("aria-label", "Decrease rating by 0.1");
  const incrementBtn = document.createElement("button");
  incrementBtn.type = "button";
  incrementBtn.className = "guess-step-btn";
  incrementBtn.textContent = "+";
  incrementBtn.setAttribute("aria-label", "Increase rating by 0.1");
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "guess-submit-btn";
  submitBtn.textContent = gameLocked ? "Review Results" : "Submit";

  let hoveredRating = null;
  const controls = [];

  function getRatingFromClientX(clientX) {
    const rect = stars.getBoundingClientRect();
    if (rect.width <= 0) return 1.0;
    const x = Math.max(rect.left, Math.min(clientX, rect.right)) - rect.left;
    const ratio = x / rect.width;
    const raw = 1 + ratio * 4;
    return Number((Math.round(raw * 10) / 10).toFixed(1));
  }

  function activeValue() {
    if (typeof hoveredRating === "number") return hoveredRating;
    if (typeof selectedGuessRating === "number") return selectedGuessRating;
    return null;
  }

  function stepGuess(delta) {
    if (gameLocked) return;
    const current = typeof selectedGuessRating === "number" ? selectedGuessRating : 3.0;
    const next = Number(Math.max(1, Math.min(5, current + delta)).toFixed(1));
    selectedGuessRating = next;
    hoveredRating = null;
    renderStars();
    if (activeChallenge?.challengeDate) {
      saveProgress(activeChallenge.challengeDate);
    }
  }

  function renderStars() {
    const value = activeValue();
    controls.forEach((control, index) => {
      const fill = typeof value === "number" ? Math.max(0, Math.min(1, value - index)) : 0;
      const fillPercent = Math.round(fill * 100);
      let state = "partial";
      if (fillPercent <= 0) {
        state = "empty";
      } else if (fillPercent >= 100) {
        state = "full";
      }

      control.className = `yelp-star-box guess-star-control ${state}`;
      control.style.setProperty("--fill", `${fillPercent}%`);
    });

    const selectedText = typeof selectedGuessRating === "number" ? selectedGuessRating.toFixed(1) : "--.-";
    valueLabel.textContent = `Rating: ${selectedText}`;
    stars.setAttribute("aria-valuenow", typeof value === "number" ? value.toFixed(1) : "1.0");
    if (gameLocked) {
      submitBtn.textContent = "Review Results";
      submitBtn.disabled = !lastResultPayload;
      decrementBtn.disabled = true;
      incrementBtn.disabled = true;
    } else {
      submitBtn.textContent = "Submit";
      submitBtn.disabled = typeof selectedGuessRating !== "number";
      decrementBtn.disabled = false;
      incrementBtn.disabled = false;
    }
  }

  stars.addEventListener("mousemove", (event) => {
    if (gameLocked) return;
    hoveredRating = getRatingFromClientX(event.clientX);
    renderStars();
  });

  stars.addEventListener("mouseleave", () => {
    hoveredRating = null;
    renderStars();
  });

  stars.addEventListener("click", (event) => {
    if (gameLocked) return;
    selectedGuessRating = getRatingFromClientX(event.clientX);
    hoveredRating = null;
    renderStars();
    if (activeChallenge?.challengeDate) {
      saveProgress(activeChallenge.challengeDate);
    }
  });

  stars.addEventListener("keydown", (event) => {
    if (gameLocked) return;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      stepGuess(0.1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      stepGuess(-0.1);
    } else if (event.key === "Enter" || event.key === " ") {
      const current = typeof selectedGuessRating === "number" ? selectedGuessRating : 3.0;
      selectedGuessRating = typeof selectedGuessRating === "number" ? selectedGuessRating : current;
      submitGuess(selectedGuessRating);
      event.preventDefault();
      return;
    } else {
      return;
    }
    event.preventDefault();
  });

  for (let rating = 1; rating <= 5; rating += 1) {
    const control = document.createElement("span");
    control.className = "yelp-star-box guess-star-control empty";
    control.textContent = "★";
    control.setAttribute("aria-hidden", "true");
    controls.push(control);
    stars.appendChild(control);
  }

  submitBtn.addEventListener("click", () => {
    if (gameLocked) {
      if (lastResultPayload) {
        openResultsDialog(lastResultPayload);
      }
      return;
    }
    if (typeof selectedGuessRating !== "number") return;
    submitGuess(selectedGuessRating);
  });

  decrementBtn.addEventListener("click", () => {
    stepGuess(-0.1);
  });

  incrementBtn.addEventListener("click", () => {
    stepGuess(0.1);
  });

  stepper.append(decrementBtn, incrementBtn);
  guessLeftGroup.append(stars, stepper, valueLabel);
  picker.append(guessLeftGroup, submitBtn);
  guessButtonsEl.appendChild(picker);
  renderStars();
  syncNextGameTimerVisibility();
}

async function loadToday() {
  const response = await fetch("/api/challenge/today");
  const data = await response.json();

  if (!response.ok) {
    setMessage("Could not load today’s challenge.", "warn");
    return;
  }

  activeChallenge = data;
  const saved = loadProgress(data.challengeDate);
  if (saved) {
    revealedHints = saved.revealedHints;
    activeHintIndex = Math.max(0, Math.min(saved.activeHintIndex, saved.revealedHints - 1));
    gameLocked = saved.gameLocked;
    selectedGuessRating = saved.selectedGuessRating;
    wrongGuessCount = saved.wrongGuessCount;
    totalGuessCount = saved.totalGuessCount;
    lastResultPayload = saved.lastResultPayload;
    guessHistory = Array.isArray(saved.guessHistory) ? saved.guessHistory : [];
  } else {
    revealedHints = 1;
    activeHintIndex = 0;
    gameLocked = false;
    selectedGuessRating = null;
    wrongGuessCount = 0;
    totalGuessCount = 0;
    lastResultPayload = null;
    guessHistory = [];
  }
  closeResultsDialog();
  setReplayMode(false);
  challengeDateEl.textContent = `Game: ${data.challengeDate}`;
  renderHints();
  renderGuessButtons();
  if (saved?.gameLocked && saved.lastResultPayload) {
    setMessage(saved.lastResultPayload.won ? "You already completed today’s game." : "You already finished today’s game.", "ok");
    openResultsDialog(saved.lastResultPayload);
  } else if (saved) {
    setMessage(`Progress restored. ${MAX_WRONG_GUESSES - wrongGuessCount} guess${MAX_WRONG_GUESSES - wrongGuessCount === 1 ? "" : "es"} left.`, "");
  } else {
    setMessage("", "");
  }
  syncNextGameTimerVisibility();
  saveProgress(data.challengeDate);
}

async function replayDate(challengeDate) {
  const response = await fetch(`/api/challenge/${challengeDate}?replay=1`);
  const data = await response.json();

  if (!response.ok) {
    setMessage("Could not load replay challenge.", "warn");
    return;
  }

  activeChallenge = data;
  revealedHints = 1;
  activeHintIndex = 0;
  gameLocked = false;
  selectedGuessRating = null;
  wrongGuessCount = 0;
  totalGuessCount = 0;
  lastResultPayload = null;
  guessHistory = [];
  closeResultsDialog();
  setReplayMode(true);
  challengeDateEl.textContent = `Archive game: ${data.challengeDate}`;
  renderHints();
  renderGuessButtons();
  setMessage("Replay loaded.", "ok");
  syncNextGameTimerVisibility();
}

async function bootstrap() {
  setupNavMenu();
  setupPhotoDialog();
  setupResultsDialog();
  renderGuessButtons();
  renderStreak();
  const replayDateParam = new URLSearchParams(window.location.search).get("replay");
  if (replayDateParam) {
    await replayDate(replayDateParam);
  } else {
    await loadToday();
  }
}

bootstrap();
