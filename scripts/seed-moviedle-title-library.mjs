#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const normalizeTitle = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const args = process.argv.slice(2);
const fileArg = args[0] || "tmp/filmgrab-movies-a-z-unique.txt";
const sourceArg = args[1] || "seed_filmgrab_imdb";
const absolutePath = resolve(process.cwd(), fileArg);

if (!existsSync(absolutePath)) {
  console.error(`Title file not found: ${absolutePath}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).");
  process.exit(1);
}
if (!supabaseKey) {
  console.error("Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

const raw = readFileSync(absolutePath, "utf8");
const lines = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const seen = new Set();
const rows = [];
for (const title of lines) {
  const titleNormalized = normalizeTitle(title);
  if (!titleNormalized || seen.has(titleNormalized)) {
    continue;
  }
  seen.add(titleNormalized);
  rows.push({
    title,
    title_normalized: titleNormalized,
    source: sourceArg,
  });
}

if (rows.length === 0) {
  console.log("No valid titles to seed.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "moviedle" },
});

const chunkSize = 500;
let written = 0;

for (let index = 0; index < rows.length; index += chunkSize) {
  const chunk = rows.slice(index, index + chunkSize);
  const { error } = await supabase.from("movie_titles").upsert(chunk, {
    onConflict: "title_normalized",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error(`Failed on chunk ${index / chunkSize + 1}: ${error.message}`);
    process.exit(1);
  }
  written += chunk.length;
  process.stdout.write(`\rSeeded ${written}/${rows.length} titles...`);
}

const { count, error: countError } = await supabase.from("movie_titles").select("id", { count: "exact", head: true });
if (countError) {
  console.error(`\nSeed completed, but count query failed: ${countError.message}`);
  process.exit(1);
}

console.log(`\nDone. Submitted ${rows.length} unique titles. Library total is now ${count || 0}.`);
