import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
};

const normalizeSurfaceWord = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .match(/^[a-z]+(?:['-][a-z]+)*$/)?.[0] || "";

const stripPunctuation = (value) => normalizeSurfaceWord(value).replace(/['-]/g, "");

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const main = async () => {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/sync-verble-punctuated-words.mjs <path-to-txt>");
  }

  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, "apps/web/.env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) throw new Error("Missing SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY");

  const raw = fs.readFileSync(inputPath, "utf8");
  const surfaceWords = [...new Set(raw.split(/\r?\n/).map(normalizeSurfaceWord).filter(Boolean))];
  const punctuatedWords = surfaceWords.filter((word) => /['-]/.test(word));
  if (!punctuatedWords.length) {
    throw new Error("No punctuated words found in input.");
  }

  const surfaceWordSet = new Set(surfaceWords);
  const strippedAliasesToDeactivate = [...new Set(
    punctuatedWords
      .map(stripPunctuation)
      .filter((word) => word && !surfaceWordSet.has(word))
  )];

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "verble" },
  });

  for (const batch of chunk(punctuatedWords, 500)) {
    const rows = batch.map((word) => ({ word, is_active: true }));
    const { error } = await supabase.from("dictionary_words").upsert(rows, { onConflict: "word" });
    if (error) {
      throw new Error(`Failed punctuated-word upsert: ${error.message}`);
    }
  }

  for (const batch of chunk(strippedAliasesToDeactivate, 500)) {
    const { error } = await supabase
      .from("dictionary_words")
      .update({ is_active: false })
      .in("word", batch);
    if (error) {
      throw new Error(`Failed stripped-word cleanup: ${error.message}`);
    }
  }

  console.log(`Activated ${punctuatedWords.length} punctuated words.`);
  console.log(`Deactivated ${strippedAliasesToDeactivate.length} stripped aliases.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
