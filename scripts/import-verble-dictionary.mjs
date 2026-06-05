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

const normalizeWord = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .match(/^[a-z]+(?:['-][a-z]+)*$/)?.[0] || "";

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const main = async () => {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/import-verble-dictionary.mjs <path-to-txt>");
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
  const normalized = raw.split(/\r?\n/).map(normalizeWord).filter(Boolean);
  const unique = [...new Set(normalized)];

  if (!unique.length) {
    throw new Error("No valid words found after normalization");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "verble" },
  });

  const batches = chunk(unique, 500);
  let processed = 0;

  for (const batch of batches) {
    const rows = batch.map((word) => ({ word, is_active: true }));
    const { error } = await supabase.from("dictionary_words").upsert(rows, { onConflict: "word" });
    if (error) {
      throw new Error(`Failed batch import near index ${processed}: ${error.message}`);
    }
    processed += batch.length;
  }

  const { count, error: countError } = await supabase
    .from("dictionary_words")
    .select("word", { count: "exact", head: true })
    .eq("is_active", true);

  if (countError) {
    throw new Error(`Imported, but failed to count rows: ${countError.message}`);
  }

  console.log(`Imported ${unique.length} unique words from ${inputPath}`);
  console.log(`Active words now in verble.dictionary_words: ${count ?? 0}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
