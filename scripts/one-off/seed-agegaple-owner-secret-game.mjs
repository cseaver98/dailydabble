import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(import.meta.dirname, "../..");
const bucketName = "agegaple-images";

const secretGame = {
  puzzleDate: "2026-06-05",
  relationshipType: "couple",
  personA: {
    name: "Charlie Seaver",
    birthDate: "1998-02-26",
    photoYear: 2025,
    imagePath: "/Users/charlesseaver/Pictures/charls2.jpeg",
    fileTitle: "Charlie Seaver, 2025",
    bio: "Charlie is a software developer who loves to play soccer, cheer on his Washington Commanders, play video games, and hangout with his girlfriend Dahlia.",
  },
  personB: {
    name: "Dahlia Hamandi",
    birthDate: "1997-06-05",
    photoYear: 2025,
    imagePath: "/Users/charlesseaver/Pictures/R0002894.jpg",
    fileTitle: "Dahlia Hamandi, 2025",
    bio: "Dahlia is a student trying to become a therapist! She loves to watch reality tv, do pilates, read books, and hangout with friends, bf and her family.",
  },
};

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

const ageGapYears = (leftBirthDate, rightBirthDate) => {
  const left = new Date(`${leftBirthDate}T00:00:00Z`);
  const right = new Date(`${rightBirthDate}T00:00:00Z`);
  return Math.abs(left.getTime() - right.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const uploadImage = async ({ supabase, person }) => {
  const extension = extname(person.imagePath) || ".jpg";
  const storagePath = `secret/${secretGame.puzzleDate}/${slugify(person.name)}-${person.photoYear}${extension}`;
  const bytes = readFileSync(person.imagePath);
  const contentType = extension.toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  const { error } = await supabase.storage.from(bucketName).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed uploading ${basename(person.imagePath)}: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
};

const insertSingle = async (query, label) => {
  const { data, error } = await query.select("id").single();
  if (error) {
    throw new Error(`Failed creating ${label}: ${error.message}`);
  }
  return data.id;
};

const main = async () => {
  const { apply, envFile } = parseArgs();
  const supabase = createSupabase(parseEnvFile(envFile), envFile);
  const agegaple = supabase.schema("agegaple");
  const computedAgeGapYears = ageGapYears(secretGame.personA.birthDate, secretGame.personB.birthDate);
  const dryRunSummary = {
    mode: apply ? "apply" : "dry-run",
    envFile,
    puzzleDate: secretGame.puzzleDate,
    couple: `${secretGame.personA.name} + ${secretGame.personB.name}`,
    relationshipType: secretGame.relationshipType,
    computedAgeGapYears: Number(computedAgeGapYears.toFixed(3)),
    images: [
      { person: secretGame.personA.name, path: secretGame.personA.imagePath, photoYear: secretGame.personA.photoYear },
      { person: secretGame.personB.name, path: secretGame.personB.imagePath, photoYear: secretGame.personB.photoYear },
    ],
    metadata: {
      source: "owner_provided",
      licenseVerified: true,
      visibleAttribution: "Owner-provided photos",
    },
  };

  if (!apply) {
    console.log(JSON.stringify(dryRunSummary, null, 2));
    console.log("\nDry run only. Re-run with --apply to upload images and create/schedule the candidate.");
    return;
  }

  const [personAUpload, personBUpload] = await Promise.all([
    uploadImage({ supabase, person: secretGame.personA }),
    uploadImage({ supabase, person: secretGame.personB }),
  ]);

  const nowIso = new Date().toISOString();
  const personAId = await insertSingle(
    agegaple.from("people").insert({
      name: secretGame.personA.name,
      birth_date: secretGame.personA.birthDate,
    }),
    "person A",
  );
  const personBId = await insertSingle(
    agegaple.from("people").insert({
      name: secretGame.personB.name,
      birth_date: secretGame.personB.birthDate,
    }),
    "person B",
  );
  const coupleId = await insertSingle(
    agegaple.from("couples").insert({
      person_a_id: personAId,
      person_b_id: personBId,
      relationship_type: secretGame.relationshipType,
      source: "owner_provided_secret_game",
      is_active: true,
    }),
    "couple",
  );
  const personAImageId = await insertSingle(
    agegaple.from("images").insert({
      subject_type: "person",
      subject_id: personAId,
      source: "owner_provided",
      file_title: secretGame.personA.fileTitle,
      image_url: personAUpload.publicUrl,
      thumb_url: personAUpload.publicUrl,
      source_page_url: personAUpload.publicUrl,
      license: "Owner-provided photo",
      license_url: null,
      author: "Owner-provided",
      attribution_text: "Owner-provided photos",
      metadata_json: { storagePath: personAUpload.storagePath, originalFilename: basename(secretGame.personA.imagePath) },
      is_usable: true,
    }),
    "person A image",
  );
  const personBImageId = await insertSingle(
    agegaple.from("images").insert({
      subject_type: "person",
      subject_id: personBId,
      source: "owner_provided",
      file_title: secretGame.personB.fileTitle,
      image_url: personBUpload.publicUrl,
      thumb_url: personBUpload.publicUrl,
      source_page_url: personBUpload.publicUrl,
      license: "Owner-provided photo",
      license_url: null,
      author: "Owner-provided",
      attribution_text: null,
      metadata_json: { storagePath: personBUpload.storagePath, originalFilename: basename(secretGame.personB.imagePath) },
      is_usable: true,
    }),
    "person B image",
  );
  const candidateId = await insertSingle(
    agegaple.from("puzzle_candidates").insert({
      couple_id: coupleId,
      person_a_image_id: personAImageId,
      person_b_image_id: personBImageId,
      person_a_photo_year: secretGame.personA.photoYear,
      person_b_photo_year: secretGame.personB.photoYear,
      computed_age_gap_years: Number(computedAgeGapYears.toFixed(3)),
      quality_score: 100,
      status: "approved",
      license_verified_at: nowIso,
      reviewed_at: nowIso,
      editorial_person_a_bio: secretGame.personA.bio,
      editorial_person_b_bio: secretGame.personB.bio,
    }),
    "candidate",
  );

  const { error: scheduleError } = await agegaple
    .from("daily_puzzles")
    .upsert({ puzzle_date: secretGame.puzzleDate, candidate_id: candidateId }, { onConflict: "puzzle_date" });
  if (scheduleError) {
    throw new Error(`Failed scheduling secret game: ${scheduleError.message}`);
  }

  console.log(JSON.stringify({
    ...dryRunSummary,
    personAId,
    personBId,
    coupleId,
    personAImageId,
    personBImageId,
    candidateId,
    imageUrls: [personAUpload.publicUrl, personBUpload.publicUrl],
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
