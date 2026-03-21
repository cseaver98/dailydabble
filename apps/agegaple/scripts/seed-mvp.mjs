import { createClient } from "@supabase/supabase-js";

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
const validBatchSizes = new Set([1, 5, 10, 15, 20]);
const relationshipFromPredicate = new Map([
  ["http://www.wikidata.org/prop/direct/P26", "spouse"],
  ["http://www.wikidata.org/prop/direct/P451", "partner"],
]);

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

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonWithRetry = async (url, init, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(300 * attempt);
      }
    }
  }

  throw new Error(`Failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
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

const upsertImage = async ({
  subjectId,
  fileTitle,
  imageUrl,
  thumbUrl,
  license,
  author,
  attribution,
  isUsable = true,
}) => {
  const { data: existing, error: findError } = await supabase
    .from("images")
    .select("id")
    .eq("file_title", fileTitle)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("images")
      .update({
        subject_type: "couple",
        subject_id: subjectId,
        source: "wikidata_seed",
        image_url: imageUrl,
        thumb_url: thumbUrl,
        license,
        author,
        attribution_text: attribution,
        is_usable: isUsable,
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("images")
    .insert({
      subject_type: "couple",
      subject_id: subjectId,
      source: "wikidata_seed",
      file_title: fileTitle,
      image_url: imageUrl,
      thumb_url: thumbUrl,
      license,
      author,
      attribution_text: attribution,
      is_usable: isUsable,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
};

const findOrCreateCandidate = async ({ coupleId, imageId, ageGap, qualityScore }) => {
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
      image_id: imageId,
      computed_age_gap_years: ageGap,
      quality_score: qualityScore,
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

const parseBatchSize = () => {
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

const parsePoolSize = () => {
  const arg = process.argv.find((value) => value.startsWith("--pool-size="));
  if (arg) {
    const parsed = Number(arg.split("=")[1]);
    if (Number.isFinite(parsed) && parsed >= 50 && parsed <= 3000) {
      return Math.floor(parsed);
    }
  }

  const fromEnv = Number(process.env.SEED_POOL_SIZE ?? "500");
  if (Number.isFinite(fromEnv) && fromEnv >= 50 && fromEnv <= 3000) {
    return Math.floor(fromEnv);
  }

  return 500;
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

const buildDynamicCoupleSparql = (limit) => `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX schema: <http://schema.org/>

SELECT
  ?person
  ?personLabel
  ?personBirth
  ?personArticle
  ?personSitelinks
  ?partner
  ?partnerLabel
  ?partnerBirth
  ?partnerArticle
  ?partnerSitelinks
  ?relationshipPredicate
WHERE {
  VALUES ?relationshipPredicate { wdt:P26 wdt:P451 }
  ?person ?relationshipPredicate ?partner .
  FILTER(?person != ?partner)

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

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit}
`;

const getQualityScore = ({ relationshipType, ageGap }) => {
  let score = relationshipType === "spouse" ? 82 : 76;
  if (ageGap <= 15) {
    score += 4;
  } else if (ageGap >= 30) {
    score -= 4;
  }
  return Math.max(60, Math.min(95, score));
};

const fetchDynamicCouplePool = async (limit) => {
  const query = buildDynamicCoupleSparql(limit);
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const payload = await fetchJsonWithRetry(
    url,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "AgegapleSeeder/1.0 (https://github.com/)",
      },
    },
    3,
  );

  const bindings = payload?.results?.bindings ?? [];
  const unique = new Map();

  for (const row of bindings) {
    const personQid = qidFromEntityUri(row.person?.value);
    const partnerQid = qidFromEntityUri(row.partner?.value);
    const personBirthDate = toIsoDate(row.personBirth?.value);
    const partnerBirthDate = toIsoDate(row.partnerBirth?.value);
    const personTitle = wikipediaTitleFromArticleUri(row.personArticle?.value);
    const partnerTitle = wikipediaTitleFromArticleUri(row.partnerArticle?.value);
    const personName = resolveDisplayName({
      label: row.personLabel?.value,
      wikiTitle: personTitle,
      qid: personQid,
    });
    const partnerName = resolveDisplayName({
      label: row.partnerLabel?.value,
      wikiTitle: partnerTitle,
      qid: partnerQid,
    });
    const relationshipType = relationshipFromPredicate.get(row.relationshipPredicate?.value ?? "");
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

  return shuffle(Array.from(unique.values()));
};

const meetsNotability = (item, thresholds) => {
  const personA = Number(item.personA.sitelinks ?? 0);
  const personB = Number(item.personB.sitelinks ?? 0);
  const primary = Math.max(personA, personB);
  const combined = personA + personB;

  return primary >= thresholds.minPrimarySitelinks && combined >= thresholds.minCombinedSitelinks;
};

const run = async () => {
  const targetBatchSize = parseBatchSize();
  const poolSize = parsePoolSize();
  const thresholds = parseNotabilityThresholds();
  const { usedQidKeys, usedNameKeys } = await loadUsedCoupleKeys();

  const dynamicPool = await fetchDynamicCouplePool(poolSize);
  const selectedCouples = [];
  const seenInRun = new Set();
  for (const item of dynamicPool) {
    if (selectedCouples.length >= targetBatchSize) {
      break;
    }

    const qidKey = buildCoupleKey(item.personA.wikidata_qid, item.personB.wikidata_qid);
    const nameKey = normalizeNameKey(item.personA.name, item.personB.name);
    if (
      usedQidKeys.has(qidKey) ||
      usedNameKeys.has(nameKey) ||
      seenInRun.has(qidKey) ||
      !meetsNotability(item, thresholds)
    ) {
      continue;
    }

    seenInRun.add(qidKey);
    selectedCouples.push(item);
  }

  if (selectedCouples.length === 0) {
    console.log(
      "No new eligible couples found from Wikidata for this run. Increase --pool-size or lower notability thresholds.",
    );
    return;
  }

  let createdCount = 0;
  for (const item of selectedCouples) {
    const personAId = await upsertPerson(item.personA);
    const personBId = await upsertPerson(item.personB);
    const coupleId = await findOrCreateCouple({
      personAId,
      personBId,
      relationshipType: item.relationshipType,
    });

    const coupleKey = buildCoupleKey(item.personA.wikidata_qid, item.personB.wikidata_qid);
    const placeholderFileTitle = `wikidata-placeholder-${coupleKey}.svg`;
    const placeholderImageId = await upsertImage({
      subjectId: coupleId,
      fileTitle: placeholderFileTitle,
      imageUrl: "/agegaple-mark.svg",
      thumbUrl: "/agegaple-mark.svg",
      license: "Manual placeholder",
      author: "Agegaple",
      attribution: "Placeholder image from dynamic seed. Add/curate couple photos in admin review.",
      isUsable: false,
    });

    const ageGap = computeAgeGapYears(item.personA.birth_date, item.personB.birth_date);
    const candidateId = await findOrCreateCandidate({
      coupleId,
      imageId: placeholderImageId,
      ageGap,
      qualityScore: item.qualityScore,
    });

    createdCount += 1;
    usedQidKeys.add(coupleKey);
    usedNameKeys.add(normalizeNameKey(item.personA.name, item.personB.name));

    console.log(
      `Seeded ${item.personA.name} + ${item.personB.name}: candidate ${candidateId} created with placeholder image (pending review).`,
    );
  }

  const timeZone = process.env.APP_TIMEZONE ?? "America/New_York";
  const today = getDateInTimeZone(timeZone);
  console.log(
    `Seed complete on ${today} (${timeZone}). Created ${createdCount} candidate(s), requested ${targetBatchSize}, pool=${poolSize}, primary>=${thresholds.minPrimarySitelinks}, combined>=${thresholds.minCombinedSitelinks}.`,
  );
};

run().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
