#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_STAGE_COUNT = 5;

const argMap = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.split("=");
  if (key.startsWith("--")) {
    argMap.set(key.slice(2), value ?? "true");
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const inputDir = resolve(rootDir, argMap.get("in") ?? "content/raw");
const outputDir = resolve(rootDir, argMap.get("out") ?? "content/processed");
const previewDir = resolve(rootDir, argMap.get("preview") ?? "content/previews");
const strategy = (argMap.get("strategy") ?? "original").toLowerCase();
const stageCount = Number(argMap.get("stages") ?? DEFAULT_STAGE_COUNT);

if (!Number.isFinite(stageCount) || stageCount < 2 || stageCount > 9) {
  throw new Error("--stages must be a number between 2 and 9");
}

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const slugToAnswer = (slug) => slug.replaceAll("-", " ").trim();

const listSvgFiles = (dir) =>
  readdirSync(dir)
    .filter((file) => extname(file).toLowerCase() === ".svg")
    .map((file) => join(dir, file))
    .filter((filePath) => statSync(filePath).isFile())
    .sort();

const parseViewBox = (svg) => {
  const viewBoxMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/i) || svg.match(/viewBox\s*=\s*'([^']+)'/i);
  if (viewBoxMatch) {
    return viewBoxMatch[1].trim();
  }

  const widthMatch = svg.match(/width\s*=\s*"([0-9.]+)"/i) || svg.match(/width\s*=\s*'([0-9.]+)'/i);
  const heightMatch = svg.match(/height\s*=\s*"([0-9.]+)"/i) || svg.match(/height\s*=\s*'([0-9.]+)'/i);

  const width = widthMatch ? Number(widthMatch[1]) : 512;
  const height = heightMatch ? Number(heightMatch[1]) : 512;
  return `0 0 ${width} ${height}`;
};

const extractPaths = (svg) => {
  const paths = [];
  const pathRegex = /<path\b[^>]*\bd\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi;
  let match;
  while ((match = pathRegex.exec(svg))) {
    const d = (match[2] ?? match[3] ?? "").trim();
    if (!d) continue;

    const commandCount = (d.match(/[a-zA-Z]/g) ?? []).length;
    const isClosed = /[zZ]/.test(d);
    const score = d.length + commandCount * 4 + (isClosed ? 16 : 0);
    paths.push({ d, score });
  }
  return paths;
};

const orderPaths = (paths) => {
  if (strategy === "complexity") {
    return [...paths].sort((a, b) => b.score - a.score);
  }
  return paths;
};

const splitIntoStages = (orderedPaths, count) => {
  if (orderedPaths.length === 0) {
    return Array.from({ length: count }, () => []);
  }

  const totalScore = orderedPaths.reduce((sum, path) => sum + path.score, 0);
  const target = totalScore / count;

  const stages = Array.from({ length: count }, () => []);
  let stageIndex = 0;
  let stageScore = 0;

  orderedPaths.forEach((path, index) => {
    const remainingItems = orderedPaths.length - index;
    const remainingStages = count - stageIndex;
    const mustAdvance = remainingItems <= remainingStages;

    if (
      stageIndex < count - 1 &&
      stages[stageIndex].length > 0 &&
      (stageScore >= target || mustAdvance)
    ) {
      stageIndex += 1;
      stageScore = 0;
    }

    stages[stageIndex].push(path.d);
    stageScore += path.score;
  });

  return stages;
};

const buildPreviewHtml = ({ title, viewBox, stages }) => {
  const safeTitle = escapeHtml(title);
  const stageJson = JSON.stringify(stages);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} Preview</title>
  <style>
    body { font-family: Manrope, system-ui, sans-serif; margin: 0; padding: 24px; background: #f4f6fa; color: #243041; }
    .card { max-width: 860px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 18px; box-shadow: 0 18px 34px rgba(36,48,65,0.08); }
    h1 { margin: 0 0 10px; font-size: 22px; }
    .meta { color: #5d6672; margin: 0 0 14px; font-size: 14px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    button { border: 0; border-radius: 999px; padding: 10px 14px; font-weight: 800; cursor: pointer; color: #fff; background: linear-gradient(135deg, #1768a6, #0e4e7f); }
    .chip { border-radius: 999px; padding: 8px 12px; background: #e7f2fc; color: #0e4e7f; font-size: 13px; font-weight: 700; }
    .canvas { border: 1px solid #d8dce2; border-radius: 12px; min-height: 420px; display: grid; place-items: center; background: #fbfdff; padding: 8px; }
    svg { width: min(100%, 680px); height: auto; }
    .path { fill: none; stroke: #0e4e7f; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: draw .8s ease forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p class="meta">Preview the auto-split reveal stages generated from this SVG.</p>
    <div class="toolbar">
      <button id="prev">Previous stage</button>
      <button id="next">Next stage</button>
      <button id="reset">Restart</button>
      <span class="chip" id="stageLabel">Stage 1/${stages.length}</span>
    </div>
    <div class="canvas">
      <svg id="svg" viewBox="${escapeHtml(viewBox)}" aria-label="Doodle preview"></svg>
    </div>
  </div>

  <script>
    const stages = ${stageJson};
    const svg = document.getElementById('svg');
    const label = document.getElementById('stageLabel');
    let visible = 1;

    function render() {
      const current = stages.slice(0, visible).flat();
      svg.innerHTML = current.map((d, i) => '<path class="path" d="' + d.replaceAll('"', '&quot;') + '" style="animation-delay:' + (i * 45) + 'ms" />').join('');
      label.textContent = 'Stage ' + visible + '/' + stages.length;
    }

    document.getElementById('prev').addEventListener('click', () => {
      visible = Math.max(1, visible - 1);
      render();
    });

    document.getElementById('next').addEventListener('click', () => {
      visible = Math.min(stages.length, visible + 1);
      render();
    });

    document.getElementById('reset').addEventListener('click', () => {
      visible = 1;
      render();
    });

    render();
  </script>
</body>
</html>`;
};

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

const files = listSvgFiles(inputDir);
if (files.length === 0) {
  console.log(`No SVG files found in ${inputDir}`);
  process.exit(0);
}

const manifest = [];

for (const filePath of files) {
  const filename = basename(filePath);
  const slug = basename(filename, extname(filename));
  const svg = readFileSync(filePath, "utf8");

  const viewBox = parseViewBox(svg);
  const rawPaths = extractPaths(svg);

  if (rawPaths.length === 0) {
    console.warn(`Skipping ${filename}: no <path d="..."> elements found.`);
    continue;
  }

  const orderedPaths = orderPaths(rawPaths);
  const stages = splitIntoStages(orderedPaths, stageCount).slice().reverse();

  const record = {
    slug,
    answer: slugToAnswer(slug),
    aliases: [],
    viewBox,
    stageCount,
    pathCount: rawPaths.length,
    strategy,
    stages,
  };

  manifest.push(record);

  writeFileSync(join(outputDir, `${slug}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const previewHtml = buildPreviewHtml({ title: slug, viewBox, stages });
  writeFileSync(join(previewDir, `${slug}.html`), previewHtml, "utf8");
}

writeFileSync(
  join(outputDir, "puzzles.generated.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), strategy, stageCount, items: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Generated ${manifest.length} doodle files.`);
console.log(`JSON output: ${outputDir}`);
console.log(`Preview output: ${previewDir}`);
