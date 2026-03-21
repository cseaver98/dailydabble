const path = require("path");
const Database = require("better-sqlite3");
const seedBusinesses = require("./seedBusinesses");
const {
  isYelpConfigured,
  getDailyYelpBusiness,
  refreshYelpProviderContent
} = require("./providers/yelp");

const DB_PATH = path.join(__dirname, "..", "data", "yelple.db");
const CONTENT_TTL_HOURS = 24;

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    business_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    category TEXT NOT NULL,
    rating REAL NOT NULL,
    review_hint_1 TEXT NOT NULL,
    review_hint_2 TEXT NOT NULL,
    review_hint_3 TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'demo',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS challenges (
    challenge_date TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'demo',
    place_name TEXT,
    city TEXT,
    state TEXT,
    category TEXT,
    actual_rating REAL,
    provider_content_json TEXT,
    provider_content_expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    refreshed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_date TEXT NOT NULL,
    guessed_rating REAL NOT NULL,
    actual_rating REAL NOT NULL,
    is_correct INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function hasColumn(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((col) => col.name === column);
}

function addColumnIfMissing(table, definition) {
  const columnName = definition.split(" ")[0];
  if (!hasColumn(table, columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

addColumnIfMissing("challenges", "source TEXT NOT NULL DEFAULT 'demo'");
addColumnIfMissing("challenges", "place_name TEXT");
addColumnIfMissing("challenges", "city TEXT");
addColumnIfMissing("challenges", "state TEXT");
addColumnIfMissing("challenges", "category TEXT");
addColumnIfMissing("challenges", "actual_rating REAL");

const insertBusiness = db.prepare(`
  INSERT OR IGNORE INTO businesses (
    business_id, name, city, state, category, rating,
    review_hint_1, review_hint_2, review_hint_3, source
  )
  VALUES (
    @businessId, @name, @city, @state, @category, @rating,
    @reviewHint1, @reviewHint2, @reviewHint3, @source
  )
`);

for (const business of seedBusinesses) {
  insertBusiness.run({ ...business, source: "demo" });
}

const upsertYelpBusiness = db.prepare(`
  INSERT INTO businesses (
    business_id, name, city, state, category, rating,
    review_hint_1, review_hint_2, review_hint_3, source
  ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', 'yelp')
  ON CONFLICT(business_id) DO UPDATE SET
    name = excluded.name,
    city = excluded.city,
    state = excluded.state,
    category = excluded.category,
    rating = excluded.rating,
    source = 'yelp'
`);

function nowIso() {
  return new Date().toISOString();
}

function toDateString(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function isoInHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickDemoBusinessForDate(challengeDate) {
  const businesses = db
    .prepare("SELECT * FROM businesses WHERE source = 'demo' ORDER BY business_id")
    .all();

  if (businesses.length === 0) {
    throw new Error("No demo businesses available");
  }

  const index = hashString(challengeDate) % businesses.length;
  return businesses[index];
}

function buildDemoProviderContent(business) {
  const reviews = [
    { text: business.review_hint_1, rating: null, author: "Demo", date: null },
    { text: business.review_hint_2, rating: null, author: "Demo", date: null },
    { text: business.review_hint_3, rating: null, author: "Demo", date: null }
  ];

  return {
    hint1: business.review_hint_1,
    hint2: business.review_hint_2,
    hint3: business.review_hint_3,
    reviews,
    photos: [],
    category: business.category,
    city: business.city,
    state: business.state
  };
}

function createChallengeRecord({
  challengeDate,
  source,
  businessId,
  placeName,
  city,
  state,
  category,
  actualRating,
  providerContent
}) {
  db.prepare(`
    INSERT INTO challenges (
      challenge_date,
      business_id,
      source,
      place_name,
      city,
      state,
      category,
      actual_rating,
      provider_content_json,
      provider_content_expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    challengeDate,
    businessId,
    source,
    placeName,
    city,
    state,
    category,
    actualRating,
    providerContent ? JSON.stringify(providerContent) : null,
    providerContent ? isoInHours(CONTENT_TTL_HOURS) : null,
    nowIso()
  );
}

async function ensureChallenge(challengeDate) {
  const normalizedDate = toDateString(challengeDate);
  const existing = db
    .prepare("SELECT challenge_date FROM challenges WHERE challenge_date = ?")
    .get(normalizedDate);

  if (existing) {
    return normalizedDate;
  }

  if (isYelpConfigured()) {
    try {
      const yelpData = await getDailyYelpBusiness(normalizedDate);
      upsertYelpBusiness.run(
        yelpData.business.id,
        yelpData.business.name,
        yelpData.business.city,
        yelpData.business.state,
        yelpData.business.category,
        yelpData.business.rating
      );

      createChallengeRecord({
        challengeDate: normalizedDate,
        source: "yelp",
        businessId: yelpData.business.id,
        placeName: yelpData.business.name,
        city: yelpData.business.city,
        state: yelpData.business.state,
        category: yelpData.business.category,
        actualRating: yelpData.business.rating,
        providerContent: yelpData.providerContent
      });

      return normalizedDate;
    } catch (error) {
      console.error(`Yelp ingestion failed for ${normalizedDate}; falling back to demo data.`, error.message);
    }
  }

  const business = pickDemoBusinessForDate(normalizedDate);
  createChallengeRecord({
    challengeDate: normalizedDate,
    source: "demo",
    businessId: business.business_id,
    placeName: business.name,
    city: business.city,
    state: business.state,
    category: business.category,
    actualRating: business.rating,
    providerContent: buildDemoProviderContent(business)
  });

  return normalizedDate;
}

async function refreshProviderContent(challengeDate) {
  const row = db
    .prepare(`
      SELECT challenge_date, source, business_id
      FROM challenges
      WHERE challenge_date = ?
    `)
    .get(challengeDate);

  if (!row) return null;

  let providerContent;
  if (row.source === "yelp") {
    try {
      providerContent = await refreshYelpProviderContent(row.business_id);
    } catch (error) {
      console.error(`Failed to refresh Yelp provider content for ${challengeDate}`, error.message);
      return null;
    }
  } else {
    const business = db
      .prepare("SELECT * FROM businesses WHERE business_id = ?")
      .get(row.business_id);

    if (!business) return null;
    providerContent = buildDemoProviderContent(business);
  }

  db.prepare(`
    UPDATE challenges
    SET provider_content_json = ?,
        provider_content_expires_at = ?,
        refreshed_at = ?
    WHERE challenge_date = ?
  `).run(
    JSON.stringify(providerContent),
    isoInHours(CONTENT_TTL_HOURS),
    nowIso(),
    challengeDate
  );

  return providerContent;
}

function purgeExpiredProviderContent() {
  const result = db.prepare(`
    UPDATE challenges
    SET provider_content_json = NULL
    WHERE provider_content_json IS NOT NULL
      AND provider_content_expires_at IS NOT NULL
      AND provider_content_expires_at < ?
  `).run(nowIso());

  return result.changes;
}

async function getChallenge(challengeDate, { allowRefresh = false } = {}) {
  const normalizedDate = toDateString(challengeDate);

  const row = db
    .prepare(`
      SELECT
        c.challenge_date,
        c.source,
        c.business_id,
        c.place_name,
        c.city,
        c.state,
        c.category,
        c.actual_rating,
        c.provider_content_json,
        c.provider_content_expires_at,
        b.name AS business_name_fallback,
        b.city AS business_city_fallback,
        b.state AS business_state_fallback,
        b.category AS business_category_fallback,
        b.rating AS business_rating_fallback
      FROM challenges c
      LEFT JOIN businesses b ON b.business_id = c.business_id
      WHERE challenge_date = ?
    `)
    .get(normalizedDate);

  if (!row) return null;

  let providerContent = row.provider_content_json
    ? JSON.parse(row.provider_content_json)
    : null;

  if (!providerContent && allowRefresh) {
    providerContent = await refreshProviderContent(normalizedDate);
  }

  return {
    challengeDate: row.challenge_date,
    source: row.source,
    expiresAt: row.provider_content_expires_at,
    business: {
      id: row.business_id,
      name: row.place_name || row.business_name_fallback || null,
      city: row.city || row.business_city_fallback || null,
      state: row.state || row.business_state_fallback || null,
      category: row.category || row.business_category_fallback || null,
      rating: row.actual_rating || row.business_rating_fallback || null
    },
    hints: providerContent,
    hasProviderContent: Boolean(providerContent)
  };
}

async function recordGuess({ challengeDate, guessedRating }) {
  const challenge = await getChallenge(challengeDate, { allowRefresh: false });
  if (!challenge) return null;

  const actualRating = Number(challenge.business.rating);
  const normalizedGuess = Number(guessedRating);
  const isCorrect = normalizedGuess === actualRating ? 1 : 0;

  db.prepare(`
    INSERT INTO guesses (challenge_date, guessed_rating, actual_rating, is_correct)
    VALUES (?, ?, ?, ?)
  `).run(challengeDate, normalizedGuess, actualRating, isCorrect);

  return {
    isCorrect: Boolean(isCorrect),
    actualRating
  };
}

function getArchive(limit = 30) {
  return db
    .prepare(`
      SELECT
        challenge_date,
        place_name,
        city,
        state,
        actual_rating,
        provider_content_json,
        source
      FROM challenges
      ORDER BY challenge_date DESC
      LIMIT ?
    `)
    .all(limit)
    .map((row) => ({
      challengeDate: row.challenge_date,
      placeName: row.place_name,
      city: row.city,
      state: row.state,
      rating: row.actual_rating,
      source: row.source,
      hasProviderContent: Boolean(row.provider_content_json)
    }));
}

module.exports = {
  CONTENT_TTL_HOURS,
  ensureChallenge,
  getChallenge,
  getArchive,
  purgeExpiredProviderContent,
  recordGuess,
  toDateString,
  isYelpConfigured
};
