import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "..");
const localEnvPath = resolve(repoRoot, "apps/web/.env.local");
const remoteEnvPath = resolve(repoRoot, "apps/web/.env.local.remote-backup-20260620");

const parseEnvFile = (path) => {
  const env = {};
  const source = readFileSync(path, "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
};

const getServiceKey = (env) => env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const createSupabase = (env, label) => {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = getServiceKey(env);
  if (!url || !serviceKey) {
    throw new Error(`Missing Supabase URL/service key for ${label}`);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

const table = (client, schema, tableName) => client.schema(schema).from(tableName);

const fetchAll = async (client, schema, tableName, columns, orderColumn) => {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await table(client, schema, tableName)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Failed fetching ${schema}.${tableName}: ${error.message}`);
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
};

const fetchFirstScheduleRows = async (client, schema, tableName = "daily_schedule", limit = 2) => {
  const { data, error } = await table(client, schema, tableName)
    .select("*")
    .order("puzzle_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed fetching ${schema}.${tableName}: ${error.message}`);
  return Array.isArray(data) ? data : [];
};

const fetchByIds = async (client, schema, tableName, ids) => {
  if (ids.length === 0) return [];
  const { data, error } = await table(client, schema, tableName).select("*").in("id", ids);
  if (error) throw new Error(`Failed fetching ${schema}.${tableName}: ${error.message}`);
  return Array.isArray(data) ? data : [];
};

const deleteAll = async (client, schema, tableName, column) => {
  const { error } = await table(client, schema, tableName).delete().not(column, "is", null);
  if (error) throw new Error(`Failed clearing local ${schema}.${tableName}: ${error.message}`);
};

const insertBatches = async (client, schema, tableName, rows) => {
  const batchSize = 1000;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    if (batch.length === 0) continue;
    const { error } = await table(client, schema, tableName).insert(batch);
    if (error) throw new Error(`Failed inserting local ${schema}.${tableName}: ${error.message}`);
  }
};

const replaceTable = async (local, schema, tableName, rows, deleteColumn) => {
  await deleteAll(local, schema, tableName, deleteColumn);
  await insertBatches(local, schema, tableName, rows);
};

const syncSimpleGame = async ({ remote, local, schema, scheduleTable = "daily_schedule", contentTable, fk }) => {
  const scheduleRows = await fetchFirstScheduleRows(remote, schema, scheduleTable);
  const contentIds = [...new Set(scheduleRows.map((row) => row[fk]).filter(Boolean))];
  const contentRows = await fetchByIds(remote, schema, contentTable, contentIds);

  await deleteAll(local, schema, scheduleTable, "puzzle_date");
  await deleteAll(local, schema, contentTable, "id");
  await insertBatches(local, schema, contentTable, contentRows);
  await insertBatches(local, schema, scheduleTable, scheduleRows);

  return { schedule: scheduleRows.length, content: contentRows.length };
};

const syncAgegaple = async ({ remote, local }) => {
  const scheduleRows = await fetchFirstScheduleRows(remote, "agegaple", "daily_puzzles");
  const candidateIds = [...new Set(scheduleRows.map((row) => row.candidate_id).filter(Boolean))];
  const candidateRows = await fetchByIds(remote, "agegaple", "puzzle_candidates", candidateIds);
  const coupleIds = [...new Set(candidateRows.map((row) => row.couple_id).filter(Boolean))];
  const imageIds = [...new Set(candidateRows.map((row) => row.image_id).filter(Boolean))];
  const coupleRows = await fetchByIds(remote, "agegaple", "couples", coupleIds);
  const personIds = [...new Set(coupleRows.flatMap((row) => [row.person_a_id, row.person_b_id]).filter(Boolean))];
  const personRows = await fetchByIds(remote, "agegaple", "people", personIds);
  const primaryImageRows = await fetchByIds(remote, "agegaple", "images", imageIds);

  const { data: coupleImageRows, error: coupleImageError } = await table(remote, "agegaple", "images")
    .select("*")
    .eq("subject_type", "couple")
    .in("subject_id", coupleIds);
  if (coupleImageError) throw new Error(`Failed fetching agegaple.images: ${coupleImageError.message}`);

  const imageRowsById = new Map();
  for (const row of [...primaryImageRows, ...((Array.isArray(coupleImageRows) ? coupleImageRows : []))]) {
    imageRowsById.set(row.id, row);
  }
  const imageRows = [...imageRowsById.values()];

  await deleteAll(local, "agegaple", "guesses", "id");
  await deleteAll(local, "agegaple", "daily_puzzles", "puzzle_date");
  await deleteAll(local, "agegaple", "puzzle_candidates", "id");
  await deleteAll(local, "agegaple", "images", "id");
  await deleteAll(local, "agegaple", "couples", "id");
  await deleteAll(local, "agegaple", "people", "id");

  await insertBatches(local, "agegaple", "people", personRows);
  await insertBatches(local, "agegaple", "couples", coupleRows);
  await insertBatches(local, "agegaple", "images", imageRows);
  await insertBatches(local, "agegaple", "puzzle_candidates", candidateRows);
  await insertBatches(local, "agegaple", "daily_puzzles", scheduleRows);

  return {
    schedule: scheduleRows.length,
    candidates: candidateRows.length,
    couples: coupleRows.length,
    people: personRows.length,
    images: imageRows.length,
  };
};

const main = async () => {
  const localEnv = parseEnvFile(localEnvPath);
  const remoteEnv = parseEnvFile(remoteEnvPath);
  const local = createSupabase(localEnv, "local");
  const remote = createSupabase(remoteEnv, "remote");

  const dictionaryWords = await fetchAll(remote, "verble", "dictionary_words", "word,is_active", "word");
  const movieTitles = await fetchAll(remote, "moviedle", "movie_titles", "title,title_normalized,imdb_id,source", "title_normalized");

  const games = {};
  games.verble = await syncSimpleGame({ remote, local, schema: "verble", contentTable: "phrases", fk: "phrase_id" });
  games.doodle = await syncSimpleGame({ remote, local, schema: "doodle", contentTable: "puzzles", fk: "puzzle_id" });
  games.equadle = await syncSimpleGame({ remote, local, schema: "equadle", contentTable: "puzzles", fk: "puzzle_id" });
  games.moviedle = await syncSimpleGame({ remote, local, schema: "moviedle", contentTable: "movies", fk: "movie_id" });
  games.yeardle = await syncSimpleGame({ remote, local, schema: "yeardle", contentTable: "events", fk: "event_id" });
  games.sportle = await syncSimpleGame({ remote, local, schema: "sportle", contentTable: "athletes", fk: "athlete_id" });
  games.agegaple = await syncAgegaple({ remote, local });

  await replaceTable(local, "verble", "dictionary_words", dictionaryWords, "word");
  await replaceTable(local, "moviedle", "movie_titles", movieTitles, "title_normalized");

  console.log(JSON.stringify({
    ok: true,
    synced: {
      firstTwoGames: games,
      dictionaryWords: dictionaryWords.length,
      movieTitles: movieTitles.length,
    },
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
