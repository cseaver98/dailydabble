import { createClient } from "@supabase/supabase-js";
import { seedBusinesses } from "./seedBusinesses";
import { getDailyYelpBusiness, isYelpConfigured, refreshYelpProviderContent } from "./yelp";

export const CONTENT_TTL_HOURS = Number(process.env.CONTENT_TTL_HOURS || 24);
const DB_SCHEMA = process.env.SUPABASE_DB_SCHEMA || "yelple";

let adminClient;

function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return adminClient;
}

function nowIso() {
  return new Date().toISOString();
}

export function toDateString(date) {
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
  const index = hashString(challengeDate) % seedBusinesses.length;
  return seedBusinesses[index];
}

function buildDemoProviderContent(business) {
  const reviews = [
    { text: business.reviewHint1, rating: null, author: "Demo", date: null },
    { text: business.reviewHint2, rating: null, author: "Demo", date: null },
    { text: business.reviewHint3, rating: null, author: "Demo", date: null }
  ];

  return {
    hint1: business.reviewHint1,
    hint2: business.reviewHint2,
    hint3: business.reviewHint3,
    reviews,
    photos: [],
    category: business.category,
    city: business.city,
    state: business.state
  };
}

async function upsertBusiness(business, { source = "demo", hints = null } = {}) {
  const supabase = getSupabaseAdmin();

  const row = {
    business_id: business.id || business.businessId,
    name: business.name,
    city: business.city,
    state: business.state,
    category: business.category,
    rating: business.rating,
    source,
    review_hint_1: hints?.hint1 || business.reviewHint1 || "",
    review_hint_2: hints?.hint2 || business.reviewHint2 || "",
    review_hint_3: hints?.hint3 || business.reviewHint3 || ""
  };

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("businesses")
    .upsert(row, { onConflict: "business_id" });

  if (error) throw error;
}

async function ensureDemoBusinessesSeeded() {
  const supabase = getSupabaseAdmin();

  const rows = seedBusinesses.map((b) => ({
    business_id: b.businessId,
    name: b.name,
    city: b.city,
    state: b.state,
    category: b.category,
    rating: b.rating,
    review_hint_1: b.reviewHint1,
    review_hint_2: b.reviewHint2,
    review_hint_3: b.reviewHint3,
    source: "demo"
  }));

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("businesses")
    .upsert(rows, { onConflict: "business_id" });

  if (error) throw error;
}

async function createChallengeRecord({
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
  const supabase = getSupabaseAdmin();

  const row = {
    challenge_date: challengeDate,
    business_id: businessId,
    source,
    place_name: placeName,
    city,
    state,
    category,
    actual_rating: actualRating,
    provider_content_json: providerContent || null,
    provider_content_expires_at: providerContent ? isoInHours(CONTENT_TTL_HOURS) : null,
    created_at: nowIso()
  };

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .upsert(row, { onConflict: "challenge_date" });

  if (error) throw error;
}

export async function ensureChallenge(challengeDate) {
  const supabase = getSupabaseAdmin();
  const normalizedDate = toDateString(challengeDate);

  const { data: existing, error: existingErr } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .select("challenge_date")
    .eq("challenge_date", normalizedDate)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing) return normalizedDate;

  await ensureDemoBusinessesSeeded();

  if (isYelpConfigured()) {
    try {
      const yelpData = await getDailyYelpBusiness(normalizedDate);

      await upsertBusiness(
        {
          id: yelpData.business.id,
          name: yelpData.business.name,
          city: yelpData.business.city,
          state: yelpData.business.state,
          category: yelpData.business.category,
          rating: yelpData.business.rating
        },
        {
          source: "yelp",
          hints: yelpData.providerContent
        }
      );

      await createChallengeRecord({
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
  await upsertBusiness(business, { source: "demo", hints: buildDemoProviderContent(business) });
  await createChallengeRecord({
    challengeDate: normalizedDate,
    source: "demo",
    businessId: business.businessId,
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
  const supabase = getSupabaseAdmin();

  const { data: row, error: rowErr } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .select("challenge_date, source, business_id")
    .eq("challenge_date", challengeDate)
    .maybeSingle();

  if (rowErr) throw rowErr;
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
    const demoBusiness = seedBusinesses.find((b) => b.businessId === row.business_id);
    if (!demoBusiness) return null;
    providerContent = buildDemoProviderContent(demoBusiness);
  }

  const { error: updateErr } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .update({
      provider_content_json: providerContent,
      provider_content_expires_at: isoInHours(CONTENT_TTL_HOURS),
      refreshed_at: nowIso()
    })
    .eq("challenge_date", challengeDate);

  if (updateErr) throw updateErr;

  return providerContent;
}

export async function purgeExpiredProviderContent() {
  const supabase = getSupabaseAdmin();
  const now = nowIso();

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .update({ provider_content_json: null })
    .not("provider_content_json", "is", null)
    .not("provider_content_expires_at", "is", null)
    .lt("provider_content_expires_at", now);

  if (error) throw error;
}

export async function getChallenge(challengeDate, { allowRefresh = false } = {}) {
  const supabase = getSupabaseAdmin();
  const normalizedDate = toDateString(challengeDate);

  const { data: challenge, error: challengeErr } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .select("*")
    .eq("challenge_date", normalizedDate)
    .maybeSingle();

  if (challengeErr) throw challengeErr;
  if (!challenge) return null;

  const { data: business, error: businessErr } = await supabase
    .schema(DB_SCHEMA)
    .from("businesses")
    .select("*")
    .eq("business_id", challenge.business_id)
    .maybeSingle();

  if (businessErr) throw businessErr;

  let providerContent = challenge.provider_content_json || null;
  if (!providerContent && allowRefresh) {
    providerContent = await refreshProviderContent(normalizedDate);
  }

  return {
    challengeDate: challenge.challenge_date,
    source: challenge.source,
    expiresAt: challenge.provider_content_expires_at,
    business: {
      id: challenge.business_id,
      name: challenge.place_name || business?.name || null,
      city: challenge.city || business?.city || null,
      state: challenge.state || business?.state || null,
      category: challenge.category || business?.category || null,
      rating: challenge.actual_rating || business?.rating || null
    },
    hints: providerContent,
    hasProviderContent: Boolean(providerContent)
  };
}

export async function recordGuess({ challengeDate, guessedRating }) {
  const supabase = getSupabaseAdmin();
  const challenge = await getChallenge(challengeDate, { allowRefresh: false });
  if (!challenge) return null;

  const actualRating = Number(challenge.business.rating);
  const normalizedGuess = Number(guessedRating);
  const isCorrect = normalizedGuess === actualRating ? 1 : 0;

  const { error } = await supabase
    .schema(DB_SCHEMA)
    .from("guesses")
    .insert({
      challenge_date: toDateString(challengeDate),
      guessed_rating: normalizedGuess,
      actual_rating: actualRating,
      is_correct: isCorrect,
      played_at: nowIso()
    });

  if (error) throw error;

  return {
    isCorrect: Boolean(isCorrect),
    actualRating
  };
}

export async function getArchive(limit = 30) {
  const supabase = getSupabaseAdmin();
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 30, 365));

  const { data, error } = await supabase
    .schema(DB_SCHEMA)
    .from("challenges")
    .select("challenge_date, place_name, city, state, actual_rating, provider_content_json, source")
    .order("challenge_date", { ascending: false })
    .limit(normalizedLimit);

  if (error) throw error;

  return (data || []).map((row) => ({
    challengeDate: row.challenge_date,
    placeName: row.place_name,
    city: row.city,
    state: row.state,
    rating: row.actual_rating,
    source: row.source,
    hasProviderContent: Boolean(row.provider_content_json)
  }));
}
