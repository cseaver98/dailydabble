const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  CONTENT_TTL_HOURS,
  ensureChallenge,
  getArchive,
  getChallenge,
  isYelpConfigured,
  purgeExpiredProviderContent,
  recordGuess,
  toDateString
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

async function initDailyState() {
  await ensureChallenge(new Date());
  purgeExpiredProviderContent();
}

initDailyState().catch((error) => {
  console.error("Failed to initialize daily state", error);
});

setInterval(async () => {
  try {
    await ensureChallenge(new Date());
    purgeExpiredProviderContent();
  } catch (error) {
    console.error("Hourly maintenance failed", error);
  }
}, 60 * 60 * 1000);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    yelpConfigured: isYelpConfigured()
  });
});

app.get("/api/challenge/today", async (_req, res) => {
  const today = toDateString(new Date());
  await ensureChallenge(today);

  const challenge = await getChallenge(today, { allowRefresh: true });
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }

  return res.json({
    challengeDate: challenge.challengeDate,
    source: challenge.source,
    ttlHours: CONTENT_TTL_HOURS,
    hasProviderContent: challenge.hasProviderContent,
    hints: challenge.hints,
    business: {
      city: challenge.business.city,
      state: challenge.business.state,
      category: challenge.business.category
    }
  });
});

app.get("/api/challenge/:date", async (req, res) => {
  const { date } = req.params;
  const replay = req.query.replay === "1";

  await ensureChallenge(date);
  const challenge = await getChallenge(date, { allowRefresh: replay });

  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }

  return res.json({
    challengeDate: challenge.challengeDate,
    source: challenge.source,
    hasProviderContent: challenge.hasProviderContent,
    hints: challenge.hints,
    business: {
      city: challenge.business.city,
      state: challenge.business.state,
      category: challenge.business.category
    }
  });
});

app.post("/api/guess", async (req, res) => {
  const { challengeDate, guessedRating } = req.body;

  if (!challengeDate || typeof guessedRating !== "number") {
    return res.status(400).json({ error: "challengeDate and guessedRating are required" });
  }

  const result = await recordGuess({ challengeDate, guessedRating });
  if (!result) {
    return res.status(404).json({ error: "Challenge not found" });
  }

  const challenge = await getChallenge(challengeDate, { allowRefresh: false });

  return res.json({
    isCorrect: result.isCorrect,
    actualRating: result.actualRating,
    answer: {
      id: challenge.business.id,
      name: challenge.business.name,
      city: challenge.business.city,
      state: challenge.business.state,
      category: challenge.business.category,
      yelpUrl: challenge.source === "yelp" && challenge.business.id
        ? `https://www.yelp.com/biz/${challenge.business.id}`
        : null
    },
    source: challenge.source
  });
});

app.get("/api/archive", (req, res) => {
  const limit = Number(req.query.limit) || 30;
  return res.json({ items: getArchive(limit) });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Yelple MVP listening on http://localhost:${PORT}`);
});
