import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "../..");

const simpleGames = [
  { slug: "doodle", schema: "doodle", scheduleTable: "daily_schedule", contentTable: "puzzles", fk: "puzzle_id" },
  { slug: "equadle", schema: "equadle", scheduleTable: "daily_schedule", contentTable: "puzzles", fk: "puzzle_id" },
  { slug: "moviedle", schema: "moviedle", scheduleTable: "daily_schedule", contentTable: "movies", fk: "movie_id" },
  { slug: "sportle", schema: "sportle", scheduleTable: "daily_schedule", contentTable: "athletes", fk: "athlete_id" },
  { slug: "verble", schema: "verble", scheduleTable: "daily_schedule", contentTable: "phrases", fk: "phrase_id" },
  { slug: "yeardle", schema: "yeardle", scheduleTable: "daily_schedule", contentTable: "events", fk: "event_id" },
];

const agegapleTables = {
  schema: "agegaple",
  scheduleTable: "daily_puzzles",
  candidateTable: "puzzle_candidates",
  coupleTable: "couples",
  imageTable: "images",
  peopleTable: "people",
};

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  const getValue = (name, fallback) => {
    const prefix = `${name}=`;
    const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    apply: args.has("--apply"),
    confirm: args.has("--confirm-prod-cleanup"),
    envFile: getValue("--env-file", resolve(repoRoot, "apps/web/.env.production")),
  };
};

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

const createSupabase = (env, envFile) => {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or service role key in ${envFile}`);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

const table = (client, schema, tableName) => client.schema(schema).from(tableName);

const fetchAll = async (client, schema, tableName, columns, orderColumn = "id") => {
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

const deleteWhereIdNotIn = async (client, schema, tableName, idsToKeep) => {
  if (idsToKeep.length === 0) {
    const { error } = await table(client, schema, tableName).delete().not("id", "is", null);
    if (error) throw new Error(`Failed clearing ${schema}.${tableName}: ${error.message}`);
    return;
  }

  const quotedIds = idsToKeep.map((id) => `"${id}"`).join(",");
  const { error } = await table(client, schema, tableName).delete().not("id", "in", `(${quotedIds})`);
  if (error) throw new Error(`Failed pruning ${schema}.${tableName}: ${error.message}`);
};

const deleteScheduleRowsExceptDate = async (client, schema, tableName, dateToKeep) => {
  if (!dateToKeep) {
    const { error } = await table(client, schema, tableName).delete().not("puzzle_date", "is", null);
    if (error) throw new Error(`Failed clearing ${schema}.${tableName}: ${error.message}`);
    return;
  }

  const { error } = await table(client, schema, tableName).delete().neq("puzzle_date", dateToKeep);
  if (error) throw new Error(`Failed pruning ${schema}.${tableName}: ${error.message}`);
};

const summarizeSimpleGame = async (client, game) => {
  const scheduleRows = await fetchAll(
    client,
    game.schema,
    game.scheduleTable,
    `puzzle_date,${game.fk}`,
    "puzzle_date",
  );
  const contentRows = await fetchAll(client, game.schema, game.contentTable, "id", "id");
  const keepRow = scheduleRows[0] ?? null;
  const keepContentIds = keepRow?.[game.fk] ? [keepRow[game.fk]] : [];

  return {
    slug: game.slug,
    scheduleTable: `${game.schema}.${game.scheduleTable}`,
    contentTable: `${game.schema}.${game.contentTable}`,
    keepDate: keepRow?.puzzle_date ?? null,
    keepContentIds,
    scheduleRowsBefore: scheduleRows.length,
    scheduleRowsToDelete: keepRow ? Math.max(0, scheduleRows.length - 1) : scheduleRows.length,
    contentRowsBefore: contentRows.length,
    contentRowsToDelete: Math.max(0, contentRows.length - keepContentIds.length),
  };
};

const applySimpleGameCleanup = async (client, game, summary) => {
  await deleteScheduleRowsExceptDate(client, game.schema, game.scheduleTable, summary.keepDate);
  await deleteWhereIdNotIn(client, game.schema, game.contentTable, summary.keepContentIds);
};

const summarizeAgegaple = async (client) => {
  const schema = agegapleTables.schema;
  const scheduleRows = await fetchAll(client, schema, agegapleTables.scheduleTable, "puzzle_date,candidate_id", "puzzle_date");
  const candidates = await fetchAll(
    client,
    schema,
    agegapleTables.candidateTable,
    "id,couple_id,person_a_image_id,person_b_image_id",
    "id",
  );
  const couples = await fetchAll(client, schema, agegapleTables.coupleTable, "id,person_a_id,person_b_id", "id");
  const images = await fetchAll(client, schema, agegapleTables.imageTable, "id", "id");
  const people = await fetchAll(client, schema, agegapleTables.peopleTable, "id", "id");

  const keepRow = scheduleRows[0] ?? null;
  const keepCandidateIds = keepRow?.candidate_id ? [keepRow.candidate_id] : [];
  const keepCandidates = candidates.filter((candidate) => keepCandidateIds.includes(candidate.id));
  const keepCoupleIds = [...new Set(keepCandidates.map((candidate) => candidate.couple_id).filter(Boolean))];
  const keepImageIds = [
    ...new Set(
      keepCandidates
        .flatMap((candidate) => [candidate.person_a_image_id, candidate.person_b_image_id])
        .filter(Boolean),
    ),
  ];
  const keepCouples = couples.filter((couple) => keepCoupleIds.includes(couple.id));
  const keepPeopleIds = [
    ...new Set(keepCouples.flatMap((couple) => [couple.person_a_id, couple.person_b_id]).filter(Boolean)),
  ];

  return {
    slug: "agegaple",
    scheduleTable: `${schema}.${agegapleTables.scheduleTable}`,
    keepDate: keepRow?.puzzle_date ?? null,
    keepCandidateIds,
    keepCoupleIds,
    keepImageIds,
    keepPeopleIds,
    scheduleRowsBefore: scheduleRows.length,
    scheduleRowsToDelete: keepRow ? Math.max(0, scheduleRows.length - 1) : scheduleRows.length,
    candidatesBefore: candidates.length,
    candidatesToDelete: Math.max(0, candidates.length - keepCandidateIds.length),
    couplesBefore: couples.length,
    couplesToDelete: Math.max(0, couples.length - keepCoupleIds.length),
    imagesBefore: images.length,
    imagesToDelete: Math.max(0, images.length - keepImageIds.length),
    peopleBefore: people.length,
    peopleToDelete: Math.max(0, people.length - keepPeopleIds.length),
    needsSecretGameRebuild: !keepRow,
  };
};

const applyAgegapleCleanup = async (client, summary) => {
  const schema = agegapleTables.schema;
  await deleteScheduleRowsExceptDate(client, schema, agegapleTables.scheduleTable, summary.keepDate);
  await deleteWhereIdNotIn(client, schema, agegapleTables.candidateTable, summary.keepCandidateIds);
  await deleteWhereIdNotIn(client, schema, agegapleTables.imageTable, summary.keepImageIds);
  await deleteWhereIdNotIn(client, schema, agegapleTables.coupleTable, summary.keepCoupleIds);
  await deleteWhereIdNotIn(client, schema, agegapleTables.peopleTable, summary.keepPeopleIds);
};

const main = async () => {
  const { apply, confirm, envFile } = parseArgs();
  if (apply && !confirm) {
    throw new Error("Refusing to apply cleanup without --confirm-prod-cleanup");
  }

  const env = parseEnvFile(envFile);
  const client = createSupabase(env, envFile);

  const simpleSummaries = [];
  for (const game of simpleGames) {
    simpleSummaries.push(await summarizeSimpleGame(client, game));
  }
  const agegapleSummary = await summarizeAgegaple(client);

  const summary = {
    mode: apply ? "apply" : "dry-run",
    envFile,
    simpleGames: simpleSummaries,
    agegaple: agegapleSummary,
    preservedReferenceTables: ["moviedle.movie_titles", "verble.dictionary_words"],
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply --confirm-prod-cleanup to delete rows.");
    return;
  }

  for (const [index, game] of simpleGames.entries()) {
    await applySimpleGameCleanup(client, game, simpleSummaries[index]);
  }
  await applyAgegapleCleanup(client, agegapleSummary);

  console.log("\nCleanup applied.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
