const API_BASE = "https://api.yelp.com/v3";

const DAILY_MARKETS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
  "Austin, TX",
  "Jacksonville, FL",
  "Columbus, OH",
  "Charlotte, NC",
  "Seattle, WA",
  "Denver, CO",
  "Boston, MA",
  "Nashville, TN",
  "Miami, FL",
  "Portland, OR"
];

const CATEGORY_POOL = [
  "restaurants",
  "coffee",
  "pizza",
  "ramen",
  "tacos",
  "bbq",
  "seafood",
  "italian",
  "breakfast_brunch",
  "sandwiches"
];

function isYelpConfigured() {
  return Boolean(process.env.YELP_API_KEY);
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function yelpFetchJson(path, params = {}) {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YELP_API_KEY");
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Yelp request failed (${response.status}): ${body.slice(0, 180)}`);
  }

  return response.json();
}

function normalizeReviewHint(text) {
  if (!text) return null;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact;
}

function normalizeReviewEntry(review) {
  const text = normalizeReviewHint(review?.text);
  if (!text) return null;
  return {
    text,
    rating: typeof review.rating === "number" ? review.rating : null,
    author: review?.user?.name || "Yelp user",
    url: review?.url || null,
    date: review?.time_created || null
  };
}

function buildFallbackReview(details, reviewIndex) {
  if (reviewIndex === 0) {
    return {
      text: `Popular ${details.categories?.[0]?.title || "local"} spot in ${details.location?.city || "its city"}.`,
      rating: null,
      author: "Yelple",
      url: null,
      date: null
    };
  }

  if (reviewIndex === 1) {
    return {
      text: `Common theme: ${details.price ? `price tier ${details.price}` : "varied pricing"} and ${(details.review_count || 0).toLocaleString()} total reviews.`,
      rating: null,
      author: "Yelple",
      url: null,
      date: null
    };
  }

  return {
    text: `Located near ${details.location?.display_address?.[0] || "a busy neighborhood"}.`,
    rating: null,
    author: "Yelple",
    url: null,
    date: null
  };
}

function buildPhotos(details) {
  return (details.photos || [])
    .filter(Boolean)
    .slice(0, 3)
    .map((url, index) => ({
      url,
      alt: `${details.name || "Business"} photo ${index + 1}`
    }));
}

async function getDailyYelpBusiness(challengeDate) {
  const market = DAILY_MARKETS[hashString(`${challengeDate}:market`) % DAILY_MARKETS.length];
  const category = CATEGORY_POOL[hashString(`${challengeDate}:category`) % CATEGORY_POOL.length];

  const searchData = await yelpFetchJson("/businesses/search", {
    location: market,
    categories: category,
    sort_by: "best_match",
    limit: 20
  });

  const candidates = (searchData.businesses || []).filter((b) => Boolean(b.id));
  if (!candidates.length) {
    throw new Error(`No Yelp businesses returned for ${market}/${category}`);
  }

  const startIndex = hashString(`${challengeDate}:pick`) % candidates.length;
  const attempts = Math.min(candidates.length, 8);

  let picked = null;
  let details = null;
  let reviewsData = null;

  for (let i = 0; i < attempts; i += 1) {
    const candidate = candidates[(startIndex + i) % candidates.length];
    const [candidateDetails, candidateReviews] = await Promise.all([
      yelpFetchJson(`/businesses/${candidate.id}`),
      yelpFetchJson(`/businesses/${candidate.id}/reviews`).catch(() => ({ reviews: [] }))
    ]);

    const candidatePhotos = buildPhotos(candidateDetails);
    if (candidatePhotos.length > 0) {
      picked = candidate;
      details = candidateDetails;
      reviewsData = candidateReviews;
      break;
    }
  }

  if (!details) {
    picked = candidates[startIndex];
    [details, reviewsData] = await Promise.all([
      yelpFetchJson(`/businesses/${picked.id}`),
      yelpFetchJson(`/businesses/${picked.id}/reviews`).catch(() => ({ reviews: [] }))
    ]);
  }

  const reviews = (reviewsData.reviews || [])
    .map(normalizeReviewEntry)
    .filter(Boolean)
    .slice(0, 3);

  while (reviews.length < 3) {
    reviews.push(buildFallbackReview(details, reviews.length));
  }

  const photos = buildPhotos(details);

  return {
    source: "yelp",
    business: {
      id: details.id,
      name: details.name,
      city: details.location?.city || picked.location?.city || "Unknown",
      state: details.location?.state || picked.location?.state || "",
      category: details.categories?.[0]?.title || category,
      rating: Number(details.rating)
    },
    providerContent: {
      hint1: reviews[0].text,
      hint2: reviews[1].text,
      hint3: reviews[2].text,
      reviews,
      photos,
      category: details.categories?.[0]?.title || category,
      city: details.location?.city || picked.location?.city || "Unknown",
      state: details.location?.state || picked.location?.state || ""
    }
  };
}

async function refreshYelpProviderContent(businessId) {
  const [details, reviewsData] = await Promise.all([
    yelpFetchJson(`/businesses/${businessId}`),
    yelpFetchJson(`/businesses/${businessId}/reviews`).catch(() => ({ reviews: [] }))
  ]);

  const reviews = (reviewsData.reviews || [])
    .map(normalizeReviewEntry)
    .filter(Boolean)
    .slice(0, 3);

  while (reviews.length < 3) {
    reviews.push({
      text: "Fresh review excerpts currently unavailable for this business.",
      rating: null,
      author: "Yelple",
      url: null,
      date: null
    });
  }

  const photos = buildPhotos(details);

  return {
    hint1: reviews[0].text,
    hint2: reviews[1].text,
    hint3: reviews[2].text,
    reviews,
    photos,
    category: details.categories?.[0]?.title || "Local Business",
    city: details.location?.city || "Unknown",
    state: details.location?.state || ""
  };
}

module.exports = {
  isYelpConfigured,
  getDailyYelpBusiness,
  refreshYelpProviderContent
};
