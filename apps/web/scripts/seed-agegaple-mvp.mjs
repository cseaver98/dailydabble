import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbSchema = process.env.SUPABASE_DB_SCHEMA || "agegaple";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (fallback: SUPABASE_SERVICE_ROLE_KEY)",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: supabaseDbSchema },
});

const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_API_ENDPOINT = "https://www.wikidata.org/w/api.php";
const COMMONS_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const validBatchSizes = new Set([1, 5, 10, 15, 20]);
const relationshipTypeFromWikidata = ({ predicateUri, hasEndDate }) => {
  const predicateCode = String(predicateUri ?? "").split("/").pop();
  if (predicateCode === "P26") {
    return hasEndDate ? "former_spouse" : "spouse";
  }
  if (predicateCode === "P451") {
    return hasEndDate ? "former_couple" : "couple";
  }
  return null;
};

const getDateInTimeZone = (timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute local puzzle date");
  }

  return `${year}-${month}-${day}`;
};

const normalizeNameKey = (aName, bName) =>
  [aName, bName]
    .map((name) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .sort()
    .join("|");

const buildCoupleKey = (aQid, bQid) => [aQid, bQid].sort().join("|");

const qidFromEntityUri = (uri) => {
  const parts = String(uri).split("/");
  const tail = parts[parts.length - 1] ?? "";
  return /^Q\d+$/.test(tail) ? tail : null;
};

const qidLike = (value) => /^Q\d+$/i.test(String(value ?? "").trim());

const titleToDisplayName = (title) => {
  if (!title) {
    return null;
  }

  return title
    .replaceAll("_", " ")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
};

const resolveDisplayName = ({ label, wikiTitle, qid }) => {
  const cleanLabel = String(label ?? "").trim();
  if (cleanLabel && !qidLike(cleanLabel)) {
    return cleanLabel;
  }

  const fromTitle = titleToDisplayName(wikiTitle);
  if (fromTitle && !qidLike(fromTitle)) {
    return fromTitle;
  }

  return qid ?? null;
};

const wikipediaTitleFromArticleUri = (uri) => {
  if (!uri) {
    return null;
  }
  try {
    const url = new URL(uri);
    if (url.hostname !== "en.wikipedia.org") {
      return null;
    }
    const prefix = "/wiki/";
    if (!url.pathname.startsWith(prefix)) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
};

const toIsoDate = (value) => {
  const raw = String(value ?? "");
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const computeAgeGapYears = (aBirthDate, bBirthDate) => {
  const a = new Date(`${aBirthDate}T00:00:00Z`);
  const b = new Date(`${bBirthDate}T00:00:00Z`);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return Number((diffMs / (1000 * 60 * 60 * 24 * 365.2425)).toFixed(2));
};

const currentYear = () => new Date().getUTCFullYear();

const stripHtml = (value) => {
  const normalized = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
};

const normalizeCommonsFileTitle = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    const filePathMatch = decodeURIComponent(url.pathname).match(/\/Special:FilePath\/(.+)$/);
    if (filePathMatch?.[1]) {
      return `File:${filePathMatch[1].replaceAll("_", " ")}`;
    }
    const wikiFileMatch = decodeURIComponent(url.pathname).match(/\/wiki\/(File:.+)$/);
    if (wikiFileMatch?.[1]) {
      return wikiFileMatch[1].replaceAll("_", " ");
    }
  } catch {
    // Plain Commons filenames are handled below.
  }

  const normalized = raw.replaceAll("_", " ");
  if (!normalized) {
    return null;
  }
  return normalized.startsWith("File:") ? normalized : `File:${normalized}`;
};

const parsePhotoYear = (value) => {
  const match = String(value ?? "").match(/\b(18\d{2}|19\d{2}|20\d{2}|21\d{2}|2200)\b/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  return Number.isInteger(year) && year >= 1850 && year <= 2200 ? year : null;
};

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableStatus = (status) =>
  status === 408 || status === 429 || status === 502 || status === 503 || status === 504 || status >= 520;

const computeBackoffDelay = (attempt, baseDelayMs, maxDelayMs) => {
  const expDelay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  const jitter = Math.floor(Math.random() * 250);
  return expDelay + jitter;
};

const withTimeoutSignal = (requestTimeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

const fetchJsonWithRetry = async (
  url,
  init,
  {
    attempts = 2,
    baseDelayMs = 300,
    maxDelayMs = 900,
    requestTimeoutMs = 7000,
  } = {},
) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const timeoutGuard = withTimeoutSignal(requestTimeoutMs);
      let response;
      try {
        response = await fetch(url, { ...init, signal: timeoutGuard.signal });
      } finally {
        timeoutGuard.clear();
      }
      if (!response.ok) {
        const statusError = new Error(`HTTP ${response.status}`);
        if (!isRetriableStatus(response.status) || attempt === attempts) {
          throw statusError;
        }
        lastError = statusError;
        await wait(computeBackoffDelay(attempt, baseDelayMs, maxDelayMs));
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(computeBackoffDelay(attempt, baseDelayMs, maxDelayMs));
      }
    }
  }

  throw new Error(`Failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
};

const normalizeWikipediaTitle = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

const getWikipediaSummarySettings = () => ({
  attempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 3500,
  requestTimeoutMs: 15000,
});

const wikipediaHeaders = {
  Accept: "application/json",
  "Api-User-Agent": "AgegapleSeeder/1.0 (editorial context)",
  "User-Agent": "AgegapleSeeder/1.0 (editorial context)",
};

const normalizeWikipediaSummaryPayload = (summaryPayload) => {
  const summary = String(summaryPayload?.extract ?? "").trim();
  if (!summary) {
    return null;
  }

  return {
    summary,
    pageUrl: String(summaryPayload?.content_urls?.desktop?.page ?? summaryPayload?.fullurl ?? "").trim() || null,
  };
};

const fetchWikipediaSummaryByTitle = async (title) => {
  const encoded = encodeURIComponent(title);
  try {
    const summaryPayload = await fetchJsonWithRetry(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: wikipediaHeaders },
      getWikipediaSummarySettings(),
    );

    const normalized = normalizeWikipediaSummaryPayload(summaryPayload);
    if (normalized) return normalized;
  } catch {
    // Fallback to the query API when REST summary is unavailable.
  }

  try {
    const queryPayload = await fetchJsonWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exintro=1&redirects=1&titles=${encoded}&format=json`,
      { headers: wikipediaHeaders },
      getWikipediaSummarySettings(),
    );

    const pages = queryPayload?.query?.pages ?? {};
    const firstPage = Object.values(pages).find((entry) => entry && typeof entry === "object");
    if (!firstPage || typeof firstPage !== "object") {
      return null;
    }

    return normalizeWikipediaSummaryPayload(firstPage);
  } catch {
    return null;
  }
};

const fetchWikipediaSummaryBySearch = async (query) => {
  const encoded = encodeURIComponent(query);
  try {
    const queryPayload = await fetchJsonWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encoded}&gsrlimit=1&prop=extracts|info&inprop=url&explaintext=1&exintro=1&redirects=1&format=json`,
      { headers: wikipediaHeaders },
      getWikipediaSummarySettings(),
    );
    const pages = queryPayload?.query?.pages ?? {};
    const firstPage = Object.values(pages).find((entry) => entry && typeof entry === "object");
    if (!firstPage || typeof firstPage !== "object") {
      return null;
    }

    return normalizeWikipediaSummaryPayload(firstPage);
  } catch {
    return null;
  }
};

const fetchWikipediaSummary = async (...titleCandidates) => {
  const candidates = Array.from(
    new Set(
      titleCandidates
        .flat()
        .map((title) => normalizeWikipediaTitle(title))
        .filter(Boolean)
        .flatMap((title) => [title, titleToDisplayName(title)])
        .filter(Boolean),
    ),
  );

  for (const candidate of candidates) {
    const summary = await fetchWikipediaSummaryByTitle(candidate);
    if (summary) return summary;
  }

  for (const candidate of candidates) {
    const summary = await fetchWikipediaSummaryBySearch(candidate);
    if (summary) return summary;
  }

  return null;
};

const relationshipLabelByType = {
  spouse: "married",
  couple: "a couple",
  former_spouse: "no longer married",
  former_couple: "no longer a couple",
};

const buildCandidateEditorialMetadata = async ({ personA, personB, relationshipType }) => {
  const relationshipLabel = relationshipLabelByType[relationshipType] ?? "connected";
  const [personASummary, personBSummary] = await Promise.all([
    fetchWikipediaSummary(personA.wikipedia_title, personA.name),
    fetchWikipediaSummary(personB.wikipedia_title, personB.name),
  ]);

  return {
    editorialRelationshipNote: `${personA.name} and ${personB.name} are ${relationshipLabel}.`,
    editorialPersonABio: personASummary?.summary ?? `${personA.name} is a notable public figure.`,
    editorialPersonABioUrl: personASummary?.pageUrl ?? null,
    editorialPersonBBio: personBSummary?.summary ?? `${personB.name} is a notable public figure.`,
    editorialPersonBBioUrl: personBSummary?.pageUrl ?? null,
  };
};

const upsertPerson = async ({ wikidata_qid, name, birth_date, wikipedia_title }) => {
  const { data, error } = await supabase
    .from("people")
    .upsert({ wikidata_qid, name, birth_date, wikipedia_title }, { onConflict: "wikidata_qid" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const findOrCreateCouple = async ({ personAId, personBId, relationshipType }) => {
  const { data: existing, error: findError } = await supabase
    .from("couples")
    .select("id")
    .or(`and(person_a_id.eq.${personAId},person_b_id.eq.${personBId}),and(person_a_id.eq.${personBId},person_b_id.eq.${personAId})`)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("couples")
    .insert({ person_a_id: personAId, person_b_id: personBId, relationship_type: relationshipType })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const buildFallbackCommonsMetadata = ({ fileTitle, directUrl }) => {
  const normalizedTitle = normalizeCommonsFileTitle(fileTitle);
  if (!normalizedTitle || !directUrl) {
    return null;
  }
  const sourcePageUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(normalizedTitle.replaceAll(" ", "_"))}`;
  return {
    fileTitle: normalizedTitle,
    imageUrl: directUrl,
    thumbUrl: directUrl,
    sourcePageUrl,
    license: "Wikimedia Commons (verify)",
    licenseUrl: null,
    author: null,
    attributionText: `${normalizedTitle} | Wikimedia Commons | verify license before approval`,
    photoYear: currentYear(),
    rawMetadata: { needs_manual_verification: "true" },
    usedFallbackPhotoYear: true,
    usedFallbackMetadata: true,
  };
};

const fetchCommonsImageMetadata = async ({ fileTitle, directUrl }) => {
  const normalizedTitle = normalizeCommonsFileTitle(fileTitle);
  if (!normalizedTitle) {
    return null;
  }

  try {
    const search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      titles: normalizedTitle,
      iiprop: "url|extmetadata",
      iiurlwidth: "900",
    });
    const payload = await fetchJsonWithRetry(
      `${COMMONS_API_ENDPOINT}?${search.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Api-User-Agent": "AgegapleSeeder/2.0 (Commons image metadata)",
          "User-Agent": "AgegapleSeeder/2.0 (Commons image metadata)",
        },
      },
      {
        attempts: 2,
        baseDelayMs: 250,
        maxDelayMs: 1000,
        requestTimeoutMs: 9000,
      },
    );
    const page = Object.values(payload?.query?.pages ?? {})[0];
    const imageInfo = page?.imageinfo?.[0];
    if (!page?.title || !imageInfo?.url) {
      return null;
    }

    const extmetadata = imageInfo.extmetadata ?? {};
    const rawMetadata = Object.fromEntries(
      Object.entries(extmetadata).map(([key, item]) => [key, stripHtml(item?.value) ?? ""]),
    );
    const objectName = stripHtml(extmetadata.ObjectName?.value);
    const author = stripHtml(extmetadata.Artist?.value) ?? stripHtml(extmetadata.Credit?.value);
    const license = stripHtml(extmetadata.LicenseShortName?.value) ?? stripHtml(extmetadata.UsageTerms?.value);
    const licenseUrl = stripHtml(extmetadata.LicenseUrl?.value);
    const dateTimeOriginal = stripHtml(extmetadata.DateTimeOriginal?.value);
    const photoYear = parsePhotoYear(dateTimeOriginal) ?? currentYear();
    const sourcePageUrl =
      imageInfo.descriptionurl ??
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title).replaceAll(" ", "_"))}`;
    const attributionText = [objectName ?? page.title, author, license].filter(Boolean).join(" | ");

    return {
      fileTitle: page.title,
      imageUrl: imageInfo.url,
      thumbUrl: imageInfo.thumburl ?? imageInfo.url,
      sourcePageUrl,
      license,
      licenseUrl,
      author,
      attributionText,
      photoYear,
      rawMetadata,
      usedFallbackPhotoYear: !parsePhotoYear(dateTimeOriginal),
      usedFallbackMetadata: false,
    };
  } catch {
    return buildFallbackCommonsMetadata({ fileTitle: normalizedTitle, directUrl });
  }
};

const upsertPersonImage = async ({
  subjectId,
  metadata,
}) => {
  const { data: existing, error: findError } = await supabase
    .from("images")
    .select("id")
    .eq("file_title", metadata.fileTitle)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("images")
      .update({
        subject_type: "person",
        subject_id: subjectId,
        source: "wikimedia_commons",
        image_url: metadata.imageUrl,
        thumb_url: metadata.thumbUrl,
        source_page_url: metadata.sourcePageUrl,
        license: metadata.license,
        license_url: metadata.licenseUrl,
        author: metadata.author,
        attribution_text: metadata.attributionText,
        metadata_json: metadata.rawMetadata ?? {},
        is_usable: true,
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("images")
      .insert({
      subject_type: "person",
      subject_id: subjectId,
      source: "wikimedia_commons",
      file_title: metadata.fileTitle,
      image_url: metadata.imageUrl,
      thumb_url: metadata.thumbUrl,
      source_page_url: metadata.sourcePageUrl,
      license: metadata.license,
      license_url: metadata.licenseUrl,
      author: metadata.author,
      attribution_text: metadata.attributionText,
      metadata_json: metadata.rawMetadata ?? {},
      is_usable: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const findOrCreateCandidate = async ({
  coupleId,
  ageGap,
  qualityScore,
  editorialMetadata,
  reviewNotes,
}) => {
  const { data: existing, error: findError } = await supabase
    .from("puzzle_candidates")
    .select("id")
    .eq("couple_id", coupleId)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("puzzle_candidates")
    .insert({
      couple_id: coupleId,
      person_a_image_id: null,
      person_b_image_id: null,
      person_a_photo_year: null,
      person_b_photo_year: null,
      computed_age_gap_years: ageGap,
      quality_score: qualityScore,
      review_notes: reviewNotes,
      editorial_person_a_bio: editorialMetadata.editorialPersonABio,
      editorial_person_a_bio_url: editorialMetadata.editorialPersonABioUrl,
      editorial_person_b_bio: editorialMetadata.editorialPersonBBio,
      editorial_person_b_bio_url: editorialMetadata.editorialPersonBBioUrl,
      status: "pending_review",
      reviewed_at: null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const loadUsedCoupleKeys = async () => {
  const { data, error } = await supabase
    .from("puzzle_candidates")
    .select(
      `
      couples!inner(
        person_a:people!couples_person_a_id_fkey(wikidata_qid,name),
        person_b:people!couples_person_b_id_fkey(wikidata_qid,name)
      )
      `,
    );

  if (error) {
    throw error;
  }

  const usedQidKeys = new Set();
  const usedNameKeys = new Set();
  for (const row of data ?? []) {
    const personAQid = row.couples?.person_a?.wikidata_qid;
    const personBQid = row.couples?.person_b?.wikidata_qid;
    const personAName = row.couples?.person_a?.name;
    const personBName = row.couples?.person_b?.name;

    if (personAQid && personBQid) {
      usedQidKeys.add(buildCoupleKey(personAQid, personBQid));
    }
    if (personAName && personBName) {
      usedNameKeys.add(normalizeNameKey(personAName, personBName));
    }
  }

  return { usedQidKeys, usedNameKeys };
};

const parseBatchSize = (value) => {
  if (value !== undefined) {
    const parsed = Number(value);
    if (!validBatchSizes.has(parsed)) {
      throw new Error("Invalid batch size value. Allowed: 1,5,10,15,20");
    }
    return parsed;
  }

  const arg = process.argv.find((value) => value.startsWith("--batch-size="));
  if (!arg) {
    return 1;
  }

  const parsed = Number(arg.split("=")[1]);
  if (!validBatchSizes.has(parsed)) {
    throw new Error("Invalid --batch-size value. Allowed: 1,5,10,15,20");
  }

  return parsed;
};

const parsePoolSize = (value) => {
  if (value !== undefined) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 50 && parsed <= 3000) {
      return Math.floor(parsed);
    }
    throw new Error("Invalid pool size value. Allowed range: 50-3000");
  }

  const arg = process.argv.find((value) => value.startsWith("--pool-size="));
  if (arg) {
    const parsed = Number(arg.split("=")[1]);
    if (Number.isFinite(parsed) && parsed >= 50 && parsed <= 3000) {
      return Math.floor(parsed);
    }
  }

  const fromEnv = Number(process.env.SEED_POOL_SIZE ?? "280");
  if (Number.isFinite(fromEnv) && fromEnv >= 50 && fromEnv <= 3000) {
    return Math.floor(fromEnv);
  }

  return 280;
};

const parsePersonName = (value) => {
  if (value !== undefined) {
    const normalized = String(value ?? "").trim();
    return normalized || null;
  }

  const arg = process.argv.find((value) => value.startsWith("--person-name="));
  const raw = arg ? arg.slice("--person-name=".length) : process.env.SEED_PERSON_NAME;
  const normalized = String(raw ?? "").trim();
  return normalized || null;
};

const parseIntInRange = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  if (rounded < min || rounded > max) {
    return fallback;
  }
  return rounded;
};

const parseNotabilityThresholds = () => {
  const minPrimarySitelinks = parseIntInRange(
    process.env.SEED_MIN_PRIMARY_SITELINKS ?? "60",
    5,
    500,
    60,
  );
  const minCombinedSitelinks = parseIntInRange(
    process.env.SEED_MIN_COMBINED_SITELINKS ?? "120",
    10,
    1000,
    120,
  );

  return {
    minPrimarySitelinks,
    minCombinedSitelinks: Math.max(minCombinedSitelinks, minPrimarySitelinks * 2),
  };
};

const parseWikidataFetchSettings = () => {
  const attempts = parseIntInRange(process.env.SEED_WIKIDATA_ATTEMPTS ?? "4", 1, 8, 4);
  const requestTimeoutMs = parseIntInRange(
    process.env.SEED_WIKIDATA_TIMEOUT_MS ?? "45000",
    4000,
    120000,
    45000,
  );
  const baseDelayMs = parseIntInRange(process.env.SEED_WIKIDATA_BACKOFF_BASE_MS ?? "600", 100, 5000, 600);
  const maxDelayMs = parseIntInRange(process.env.SEED_WIKIDATA_BACKOFF_MAX_MS ?? "3000", 200, 15000, 3000);

  return {
    attempts,
    requestTimeoutMs,
    baseDelayMs,
    maxDelayMs: Math.max(maxDelayMs, baseDelayMs),
  };
};

const buildDynamicCoupleSparql = (limit) => `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX schema: <http://schema.org/>

SELECT
  ?person
  ?personBirth
  ?personArticle
  ?personSitelinks
  ?partner
  ?partnerBirth
  ?partnerArticle
  ?partnerSitelinks
  ?relationshipPredicate
  ?relationshipEndDate
WHERE {
  VALUES (?relationshipProp ?relationshipPredicate) {
    (p:P26 ps:P26)
    (p:P451 ps:P451)
  }
  ?person ?relationshipProp ?relationshipStatement .
  ?relationshipStatement ?relationshipPredicate ?partner .
  FILTER(?person != ?partner)
  OPTIONAL { ?relationshipStatement pq:P582 ?relationshipEndDate . }

  ?person wdt:P31 wd:Q5 ;
          wdt:P569 ?personBirth ;
          wikibase:sitelinks ?personSitelinks .
  ?partner wdt:P31 wd:Q5 ;
           wdt:P569 ?partnerBirth ;
           wikibase:sitelinks ?partnerSitelinks .

  ?personArticle schema:about ?person ;
                 schema:isPartOf <https://en.wikipedia.org/> .
  ?partnerArticle schema:about ?partner ;
                  schema:isPartOf <https://en.wikipedia.org/> .

  FILTER(YEAR(?personBirth) >= 1900)
  FILTER(YEAR(?partnerBirth) >= 1900)
}
LIMIT ${limit}
`;

const fetchWikidataPersonByName = async (personName) => {
  const search = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    language: "en",
    uselang: "en",
    type: "item",
    limit: "8",
    search: personName,
  });
  const payload = await fetchJsonWithRetry(
    `${WIKIDATA_API_ENDPOINT}?${search.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "AgegapleSeeder/1.0 (targeted relationship search)",
      },
    },
    {
      attempts: 3,
      baseDelayMs: 350,
      maxDelayMs: 1500,
      requestTimeoutMs: 10000,
    },
  );
  const candidates = (payload?.search ?? []).filter((entry) => /^Q\d+$/.test(String(entry?.id ?? "")));
  if (candidates.length === 0) {
    throw new Error(`Could not find a Wikidata person match for "${personName}"`);
  }

  const ids = candidates.map((entry) => `wd:${entry.id}`).join(" ");
  const query = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?person WHERE {
  VALUES ?person { ${ids} }
  ?person wdt:P31 wd:Q5 .
}
LIMIT 1
`;
  const entityPayload = await fetchJsonWithRetry(
    `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "AgegapleSeeder/1.0 (targeted relationship search)",
      },
    },
    parseWikidataFetchSettings(),
  );
  const qid = qidFromEntityUri(entityPayload?.results?.bindings?.[0]?.person?.value);
  if (!qid) {
    throw new Error(`Could not find a human Wikidata match for "${personName}"`);
  }

  const matched = candidates.find((entry) => entry.id === qid);
  return {
    qid,
    label: String(matched?.label ?? personName).trim() || personName,
  };
};

const buildTargetPersonCoupleSparql = ({ qid, limit }) => `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX schema: <http://schema.org/>

SELECT
  ?person
  ?personBirth
  ?personArticle
  ?personSitelinks
  ?partner
  ?partnerBirth
  ?partnerArticle
  ?partnerSitelinks
  ?relationshipPredicate
  ?relationshipEndDate
WHERE {
  VALUES ?person { wd:${qid} }
  VALUES (?relationshipProp ?relationshipPredicate) {
    (p:P26 ps:P26)
    (p:P451 ps:P451)
  }
  {
    ?person ?relationshipProp ?relationshipStatement .
    ?relationshipStatement ?relationshipPredicate ?partner .
  }
  UNION
  {
    ?partner ?relationshipProp ?relationshipStatement .
    ?relationshipStatement ?relationshipPredicate ?person .
  }
  FILTER(?person != ?partner)
  OPTIONAL { ?relationshipStatement pq:P582 ?relationshipEndDate . }

  ?person wdt:P31 wd:Q5 ;
          wdt:P569 ?personBirth ;
          wikibase:sitelinks ?personSitelinks .
  ?partner wdt:P31 wd:Q5 ;
           wdt:P569 ?partnerBirth ;
           wikibase:sitelinks ?partnerSitelinks .

  ?personArticle schema:about ?person ;
                 schema:isPartOf <https://en.wikipedia.org/> .
  ?partnerArticle schema:about ?partner ;
                  schema:isPartOf <https://en.wikipedia.org/> .

  FILTER(YEAR(?personBirth) >= 1900)
  FILTER(YEAR(?partnerBirth) >= 1900)
}
LIMIT ${limit}
`;

const getQualityScore = ({ relationshipType, ageGap }) => {
  let score = 76;
  if (relationshipType === "spouse") {
    score = 82;
  } else if (relationshipType === "former_spouse") {
    score = 79;
  } else if (relationshipType === "former_couple") {
    score = 74;
  }
  if (ageGap <= 15) {
    score += 4;
  } else if (ageGap >= 30) {
    score -= 4;
  }
  return Math.max(60, Math.min(95, score));
};

const normalizeCouplePoolBindings = (bindings) => {
  const unique = new Map();

  for (const row of bindings) {
    const personQid = qidFromEntityUri(row.person?.value);
    const partnerQid = qidFromEntityUri(row.partner?.value);
    const personBirthDate = toIsoDate(row.personBirth?.value);
    const partnerBirthDate = toIsoDate(row.partnerBirth?.value);
    const personTitle = wikipediaTitleFromArticleUri(row.personArticle?.value);
    const partnerTitle = wikipediaTitleFromArticleUri(row.partnerArticle?.value);
    const personName = resolveDisplayName({
      label: null,
      wikiTitle: personTitle,
      qid: personQid,
    });
    const partnerName = resolveDisplayName({
      label: null,
      wikiTitle: partnerTitle,
      qid: partnerQid,
    });
    const relationshipType = relationshipTypeFromWikidata({
      predicateUri: row.relationshipPredicate?.value ?? "",
      hasEndDate: Boolean(row.relationshipEndDate?.value),
    });
    const personSitelinks = Number(row.personSitelinks?.value ?? 0);
    const partnerSitelinks = Number(row.partnerSitelinks?.value ?? 0);

    if (
      !personQid ||
      !partnerQid ||
      !personName ||
      !partnerName ||
      !personBirthDate ||
      !partnerBirthDate ||
      !personTitle ||
      !partnerTitle ||
      !relationshipType ||
      !Number.isFinite(personSitelinks) ||
      !Number.isFinite(partnerSitelinks)
    ) {
      continue;
    }

    const key = buildCoupleKey(personQid, partnerQid);
    if (unique.has(key)) {
      continue;
    }

    const ageGap = computeAgeGapYears(personBirthDate, partnerBirthDate);
    if (!Number.isFinite(ageGap) || ageGap > 80) {
      continue;
    }

    unique.set(key, {
      personA: {
        wikidata_qid: personQid,
        name: personName,
        birth_date: personBirthDate,
        wikipedia_title: personTitle,
        sitelinks: personSitelinks,
      },
      personB: {
        wikidata_qid: partnerQid,
        name: partnerName,
        birth_date: partnerBirthDate,
        wikipedia_title: partnerTitle,
        sitelinks: partnerSitelinks,
      },
      relationshipType,
      qualityScore: getQualityScore({ relationshipType, ageGap }),
    });
  }

  return Array.from(unique.values());
};

const fetchSparqlBindings = async ({ query, errorLabel }) => {
  const payload = await fetchJsonWithRetry(
    `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "AgegapleSeeder/1.0 (https://github.com/)",
      },
    },
    parseWikidataFetchSettings(),
  );
  const bindings = payload?.results?.bindings ?? [];
  if (!Array.isArray(bindings)) {
    throw new Error(`Failed to load ${errorLabel} from Wikidata`);
  }
  return bindings;
};

const fetchDynamicCouplePool = async (limit) => {
  const limitCandidates = Array.from(
    new Set([
      Math.max(50, Math.floor(limit)),
      Math.max(80, Math.floor(limit * 0.65)),
      120,
      80,
    ]),
  ).filter((value) => Number.isFinite(value) && value > 0);

  let bindings = null;
  let lastError = null;

  for (const candidateLimit of limitCandidates) {
    try {
      bindings = await fetchSparqlBindings({
        query: buildDynamicCoupleSparql(candidateLimit),
        errorLabel: "dynamic pool",
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!bindings) {
    throw new Error(
      `Failed to load dynamic pool from Wikidata: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
    );
  }

  return shuffle(normalizeCouplePoolBindings(bindings));
};

const fetchTargetPersonCouplePool = async ({ personName, limit }) => {
  const target = await fetchWikidataPersonByName(personName);
  const bindings = await fetchSparqlBindings({
    query: buildTargetPersonCoupleSparql({ qid: target.qid, limit }),
    errorLabel: `relationships for ${target.label}`,
  });
  return {
    target,
    pool: normalizeCouplePoolBindings(bindings),
  };
};

const meetsNotability = (item, thresholds) => {
  const personA = Number(item.personA.sitelinks ?? 0);
  const personB = Number(item.personB.sitelinks ?? 0);
  const primary = Math.max(personA, personB);
  const combined = personA + personB;

  return primary >= thresholds.minPrimarySitelinks && combined >= thresholds.minCombinedSitelinks;
};

export const runAgegapleSeed = async ({
  batchSize,
  poolSize: requestedPoolSize,
  personName: requestedPersonName,
  log = console.log,
} = {}) => {
  const targetBatchSize = parseBatchSize(batchSize);
  const poolSize = parsePoolSize(requestedPoolSize);
  const personName = parsePersonName(requestedPersonName);
  const thresholds = parseNotabilityThresholds();
  const { usedQidKeys, usedNameKeys } = await loadUsedCoupleKeys();

  const targetedResult = personName
    ? await fetchTargetPersonCouplePool({ personName, limit: Math.max(poolSize, 50) })
    : null;
  const dynamicPool = targetedResult ? targetedResult.pool : await fetchDynamicCouplePool(poolSize);
  const selectedCouples = [];
  const candidateBufferSize = Math.max(targetBatchSize * 8, targetBatchSize);
  const seenInRun = new Set();
  for (const item of dynamicPool) {
    if (selectedCouples.length >= candidateBufferSize) {
      break;
    }

    const qidKey = buildCoupleKey(item.personA.wikidata_qid, item.personB.wikidata_qid);
    const nameKey = normalizeNameKey(item.personA.name, item.personB.name);
    if (
      usedQidKeys.has(qidKey) ||
      usedNameKeys.has(nameKey) ||
      seenInRun.has(qidKey) ||
      (!targetedResult && !meetsNotability(item, thresholds))
    ) {
      continue;
    }

    seenInRun.add(qidKey);
    selectedCouples.push(item);
  }

  if (selectedCouples.length === 0) {
    log(
      targetedResult
        ? `No new eligible relationships found for ${targetedResult.target.label}. Existing candidates may already cover them.`
        : "No new eligible couples found from Wikidata for this run. Increase --pool-size or lower notability thresholds.",
    );
    return;
  }

  let createdCount = 0;
  for (const item of selectedCouples) {
    if (createdCount >= targetBatchSize) {
      break;
    }

    const personAId = await upsertPerson(item.personA);
    const personBId = await upsertPerson(item.personB);
    const coupleId = await findOrCreateCouple({
      personAId,
      personBId,
      relationshipType: item.relationshipType,
    });

    const coupleKey = buildCoupleKey(item.personA.wikidata_qid, item.personB.wikidata_qid);
    const ageGap = computeAgeGapYears(item.personA.birth_date, item.personB.birth_date);
    const editorialMetadata = await buildCandidateEditorialMetadata({
      personA: item.personA,
      personB: item.personB,
      relationshipType: item.relationshipType,
    });
    const candidateId = await findOrCreateCandidate({
      coupleId,
      ageGap,
      qualityScore: item.qualityScore,
      editorialMetadata,
      reviewNotes: "Needs Wikimedia Commons portraits and photo years before approval.",
    });

    createdCount += 1;
    usedQidKeys.add(coupleKey);
    usedNameKeys.add(normalizeNameKey(item.personA.name, item.personB.name));

    log(
      `Seeded ${item.personA.name} + ${item.personB.name}: candidate ${candidateId} created for image curation (pending review).`,
    );
  }

  const timeZone = process.env.TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);
  log(
    targetedResult
      ? `Seed complete on ${today} (${timeZone}). Created ${createdCount} candidate(s) for ${targetedResult.target.label} (${targetedResult.target.qid}), requested ${targetBatchSize}.`
      : `Seed complete on ${today} (${timeZone}). Created ${createdCount} candidate(s), requested ${targetBatchSize}, pool=${poolSize}, primary>=${thresholds.minPrimarySitelinks}, combined>=${thresholds.minCombinedSitelinks}.`,
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runAgegapleSeed().catch((error) => {
    console.error("Seed failed:", error.message);
    process.exit(1);
  });
}
