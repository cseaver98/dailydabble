import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "../..");
const defaultSecretDate = "2026-06-05";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = new Set(args);
  const getValue = (name, fallback = "") => {
    const prefix = `${name}=`;
    const match = args.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    apply: flags.has("--apply"),
    candidateId: getValue("--candidate-id"),
    date: getValue("--date", defaultSecretDate),
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

const hasImageAttribution = (image) =>
  Boolean(
    image?.image_url &&
    image?.source_page_url &&
    image?.license &&
    image?.license_url &&
    image?.attribution_text,
  );

const main = async () => {
  const { apply, candidateId, date, envFile } = parseArgs();
  if (!candidateId) {
    throw new Error("Missing --candidate-id=<agegaple.puzzle_candidates id>");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid --date. Use YYYY-MM-DD.");
  }

  const supabase = createSupabase(parseEnvFile(envFile), envFile).schema("agegaple");
  const { data: candidate, error: candidateError } = await supabase
    .from("puzzle_candidates")
    .select(`
      id,
      status,
      person_a_photo_year,
      person_b_photo_year,
      license_verified_at,
      couples!inner(
        person_a:people!couples_person_a_id_fkey(name),
        person_b:people!couples_person_b_id_fkey(name)
      ),
      person_a_image:images!puzzle_candidates_person_a_image_id_fkey(image_url,source_page_url,license,license_url,attribution_text,is_usable),
      person_b_image:images!puzzle_candidates_person_b_image_id_fkey(image_url,source_page_url,license,license_url,attribution_text,is_usable)
    `)
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) {
    throw new Error(`Failed to load candidate: ${candidateError.message}`);
  }
  if (!candidate) {
    throw new Error(`Candidate not found: ${candidateId}`);
  }

  const validationErrors = [];
  if (candidate.status !== "approved") validationErrors.push("candidate status is not approved");
  if (!candidate.person_a_photo_year || !candidate.person_b_photo_year) validationErrors.push("missing photo year");
  if (!candidate.person_a_image || !candidate.person_b_image) validationErrors.push("missing person image");
  if (candidate.person_a_image && !candidate.person_a_image.is_usable) validationErrors.push("person A image is not usable");
  if (candidate.person_b_image && !candidate.person_b_image.is_usable) validationErrors.push("person B image is not usable");
  if (!candidate.license_verified_at && (!hasImageAttribution(candidate.person_a_image) || !hasImageAttribution(candidate.person_b_image))) {
    validationErrors.push("missing license verification or complete image attribution");
  }

  const { data: existingDateRow, error: existingDateError } = await supabase
    .from("daily_puzzles")
    .select("id,puzzle_date,candidate_id")
    .eq("puzzle_date", date)
    .maybeSingle();
  if (existingDateError) {
    throw new Error(`Failed to check existing secret date: ${existingDateError.message}`);
  }

  const summary = {
    mode: apply ? "apply" : "dry-run",
    envFile,
    date,
    candidateId,
    couple: `${candidate.couples.person_a.name} + ${candidate.couples.person_b.name}`,
    validationErrors,
    existingDateRow,
    action: existingDateRow ? "replace scheduled candidate for date" : "insert scheduled candidate for date",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (validationErrors.length > 0) {
    throw new Error("Candidate is not ready to schedule.");
  }
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to schedule this Agegaple secret game.");
    return;
  }

  const { error: upsertError } = await supabase
    .from("daily_puzzles")
    .upsert({ puzzle_date: date, candidate_id: candidateId }, { onConflict: "puzzle_date" });
  if (upsertError) {
    throw new Error(`Failed to schedule secret game: ${upsertError.message}`);
  }

  console.log("\nAgegaple secret game scheduled.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
