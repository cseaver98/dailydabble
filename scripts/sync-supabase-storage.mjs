import { readFileSync } from "node:fs";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value = ""] = arg.split("=");
  args.set(key, value);
}

const requireArg = (name) => {
  const value = args.get(`--${name}`)?.trim();
  if (!value) {
    throw new Error(`Missing --${name}=...`);
  }
  return value;
};

const sourceUrl = requireArg("source-url");
const sourceKey = requireArg("source-key");
const destUrl = requireArg("dest-url");
const destKey = requireArg("dest-key");
const manifestPath = requireArg("manifest");

const source = createClient(sourceUrl, sourceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const dest = createClient(destUrl, destKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const manifest = readFileSync(manifestPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [bucket, ...rest] = line.split("|");
    return { bucket, path: rest.join("|") };
  });

const ensureBucket = async (bucket) => {
  const { error } = await dest.storage.createBucket(bucket, { public: false });
  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    throw new Error(`Could not ensure destination bucket ${bucket}: ${error.message}`);
  }
};

for (const bucket of [...new Set(manifest.map((entry) => entry.bucket))]) {
  await ensureBucket(bucket);
}

let synced = 0;
for (const entry of manifest) {
  const { data, error } = await source.storage.from(entry.bucket).download(entry.path);
  if (error || !data) {
    throw new Error(`Could not download ${entry.bucket}/${entry.path}: ${error?.message || "unknown error"}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: uploadError } = await dest.storage.from(entry.bucket).upload(entry.path, buffer, {
    upsert: true,
    contentType: data.type || undefined,
  });

  if (uploadError) {
    throw new Error(`Could not upload ${entry.bucket}/${entry.path}: ${uploadError.message}`);
  }

  synced += 1;
  console.log(`synced ${entry.bucket}/${entry.path}`);
}

console.log(`Done. Synced ${synced} object(s).`);
