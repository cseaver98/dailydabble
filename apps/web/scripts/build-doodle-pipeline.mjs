#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
const inputDir = resolve(rootDir, argMap.get("in") ?? "content/doodle/raw");
const outputDir = resolve(rootDir, argMap.get("out") ?? "content/doodle/processed");
const previewDir = resolve(rootDir, argMap.get("preview") ?? "content/doodle/previews");
const strategy = (argMap.get("strategy") ?? "balanced").toLowerCase();
const stageCount = Number(argMap.get("stages") ?? DEFAULT_STAGE_COUNT);
const slugFilter = (argMap.get("slug") ?? "").trim().toLowerCase();
const rawSeedArg = argMap.get("seed");
const seedArg = rawSeedArg === undefined ? Number.NaN : Number(rawSeedArg);

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

const toStageSegment = (path, to = 1, meta = {}) => {
  const segment = {
    d: path.d,
    to: Number(to.toFixed(6)),
  };
  if (path.style && Object.keys(path.style).length > 0) {
    segment.style = path.style;
  }
  if (typeof meta.complete === "boolean") {
    segment.complete = meta.complete;
  }
  if (typeof meta.fillOnly === "boolean") {
    segment.fillOnly = meta.fillOnly;
  }
  if (typeof meta.fullD === "string" && meta.fullD.length > 0) {
    segment.fullD = meta.fullD;
  }
  if (typeof meta.id === "string" && meta.id.length > 0) {
    segment.id = meta.id;
  }
  return segment;
};

const createSeededRng = (seedValue) => {
  let state = (seedValue >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const maybeShufflePaths = (paths) => {
  if (!Number.isFinite(seedArg)) {
    return paths;
  }
  const random = createSeededRng(seedArg);
  const copy = [...paths];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

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

const parsePathAttributes = (attrsText) => {
  const rawAttrs = {};
  const attrRegex = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attrsText))) {
    const key = String(attrMatch[1] || "").toLowerCase();
    const value = String(attrMatch[3] ?? attrMatch[4] ?? "").trim();
    rawAttrs[key] = value;
  }

  const styleMap = {};
  const styleValue = rawAttrs.style || "";
  for (const part of String(styleValue).split(";")) {
    const [rawKey, ...rawValue] = part.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (key && value) {
      styleMap[key] = value;
    }
  }

  const pick = (key) => rawAttrs[key] ?? styleMap[key] ?? undefined;
  const style = {};
  const supportedKeys = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "fill-rule",
  ];
  for (const key of supportedKeys) {
    const value = pick(key);
    if (typeof value === "string" && value.length > 0) {
      style[key] = value;
    }
  }

  const fill = String(style.fill ?? "").toLowerCase();
  const stroke = String(style.stroke ?? "").toLowerCase();
  const fillOnly = fill !== "" && fill !== "none" && stroke === "none";

  return {
    d: String(rawAttrs.d ?? "").trim(),
    style,
    fillOnly,
  };
};

const extractPaths = (svg) => {
  const splitPathData = (d, { allowSplit }) => {
    const normalized = String(d || "").trim();
    if (!normalized) {
      return [];
    }
    if (!allowSplit) {
      return [normalized];
    }

    const subpaths = normalized
      .match(/M[^M]*/g)
      ?.map((part) => part.trim())
      .filter(Boolean);

    if (!subpaths || subpaths.length <= 1) {
      return [normalized];
    }

    return subpaths;
  };

  const paths = [];
  const pathRegex = /<path\b([^>]*)>/gi;
  let match;
  let originalPathIndex = 0;
  while ((match = pathRegex.exec(svg))) {
    const attrsText = String(match[1] ?? "");
    const parsed = parsePathAttributes(attrsText);
    const d = parsed.d;
    if (!d) continue;

    const groupId = `g${originalPathIndex}`;
    originalPathIndex += 1;
    const subpaths = splitPathData(d, { allowSplit: true });
    for (const subpath of subpaths) {
      const commandCount = (subpath.match(/[a-zA-Z]/g) ?? []).length;
      const isClosed = /[zZ]/.test(subpath);
      const score = subpath.length + commandCount * 4 + (isClosed ? 16 : 0);
      paths.push({
        d: subpath,
        score,
        style: parsed.style,
        fillOnly: parsed.fillOnly,
        groupId,
      });
    }
  }
  return paths;
};

const orderPaths = (paths) => {
  if (strategy === "complexity") {
    return [...paths].sort((a, b) => b.score - a.score);
  }
  if (strategy === "balanced") {
    return [...paths].sort((a, b) => a.score - b.score);
  }
  return paths;
};

const buildIncrementRatios = (count) => {
  if (count === 5) {
    return [0.1, 0.1, 0.1, 0.1, 0.6];
  }

  const raw = Array.from({ length: count }, (_, index) => 1 + index * 0.04);
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
};

const varyRatios = (ratios, random) => {
  if (!random) {
    return ratios;
  }

  const varied = ratios.map((ratio) => ratio * (0.9 + random() * 0.2));
  const total = varied.reduce((sum, value) => sum + value, 0);
  return varied.map((value) => value / total);
};

const parsePathGeometry = (d) => {
  const values = (String(d).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number).filter(Number.isFinite);
  if (values.length < 2) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index + 1 < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const computeCellKey = (geometry, bounds) => {
  const width = Math.max(1e-6, bounds.maxX - bounds.minX);
  const height = Math.max(1e-6, bounds.maxY - bounds.minY);
  const gx = Math.min(2, Math.max(0, Math.floor(((geometry.centerX - bounds.minX) / width) * 3)));
  const gy = Math.min(2, Math.max(0, Math.floor(((geometry.centerY - bounds.minY) / height) * 3)));
  return `${gx}:${gy}`;
};

const assignPathsToBuckets = (paths, count) => {
  const random = Number.isFinite(seedArg) ? createSeededRng(seedArg) : null;
  const incrementRatios = varyRatios(buildIncrementRatios(count), random);
  const totalScore = paths.reduce((sum, path) => sum + path.score, 0);
  const withGeometry = paths.map((path) => ({
    ...path,
    geometry: parsePathGeometry(path.d),
  }));
  const globalBounds = withGeometry.reduce(
    (acc, path) => ({
      minX: Math.min(acc.minX, path.geometry.minX),
      minY: Math.min(acc.minY, path.geometry.minY),
      maxX: Math.max(acc.maxX, path.geometry.maxX),
      maxY: Math.max(acc.maxY, path.geometry.maxY),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const buckets = incrementRatios.map((ratio) => ({
    target: totalScore * ratio,
    score: 0,
    paths: [],
    cells: new Set(),
  }));

  const sorted = withGeometry
    .map((path) => ({ path, tieBreaker: random ? random() : 0 }))
    .sort((a, b) => b.path.score - a.path.score || a.tieBreaker - b.tieBreaker)
    .map(({ path }) => path);

  for (const path of sorted) {
    const candidates = [];
    const cellKey = computeCellKey(path.geometry, globalBounds);

    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index];
      const nextScore = bucket.score + path.score;
      const targetGap = Math.abs(nextScore - bucket.target);
      const overflow = Math.max(0, nextScore - bucket.target);
      const hasCell = bucket.cells.has(cellKey);
      const spreadBonus = hasCell ? 0 : Math.min(path.score * 0.2, bucket.target * 0.25);
      const earlyOverflowGuard =
        index === 0 && nextScore > bucket.target * 1.9 && sorted.length > 6 ? overflow * 6 : 0;
      const variance = random ? (random() - 0.5) * bucket.target * 0.2 : 0;
      const metric = targetGap + overflow * 2.2 + earlyOverflowGuard - spreadBonus + bucket.paths.length * 0.01 + variance;
      candidates.push({ index, metric });
    }

    candidates.sort((a, b) => a.metric - b.metric);
    const bestMetric = candidates[0]?.metric ?? 0;
    const nearBest = candidates.filter(({ metric }) => metric <= bestMetric + Math.max(path.score * 0.16, totalScore * 0.012));
    const chosen = random && nearBest.length > 1
      ? nearBest[Math.floor(random() * nearBest.length)]
      : candidates[0];
    const chosenIndex = chosen?.index ?? 0;

    buckets[chosenIndex].paths.push(path);
    buckets[chosenIndex].score += path.score;
    buckets[chosenIndex].cells.add(cellKey);
  }

  const takeSmallestPath = (bucket) => {
    if (!bucket || bucket.paths.length === 0) {
      return null;
    }
    let smallestIndex = 0;
    for (let index = 1; index < bucket.paths.length; index += 1) {
      if (bucket.paths[index].score < bucket.paths[smallestIndex].score) {
        smallestIndex = index;
      }
    }
    const [picked] = bucket.paths.splice(smallestIndex, 1);
    bucket.score -= picked.score;
    if (bucket.paths.length === 0) {
      bucket.cells.clear();
    }
    return picked;
  };

  for (let index = 1; index < buckets.length; index += 1) {
    if (buckets[index].paths.length > 0) {
      continue;
    }

    if (index + 1 < buckets.length && buckets[index + 1].paths.length === 1) {
      const promoted = buckets[index + 1].paths.pop();
      buckets[index + 1].score -= promoted.score;
      buckets[index].paths.push(promoted);
      buckets[index].score += promoted.score;
      buckets[index].cells.add(computeCellKey(promoted.geometry, globalBounds));
      if (buckets[index + 1].paths.length === 0) {
        buckets[index + 1].cells.clear();
      }

      let donorIndex = -1;
      for (let candidate = 0; candidate <= index; candidate += 1) {
        if (buckets[candidate].paths.length > 1) {
          if (donorIndex === -1 || buckets[candidate].score > buckets[donorIndex].score) {
            donorIndex = candidate;
          }
        }
      }

      if (donorIndex >= 0) {
        const borrowed = takeSmallestPath(buckets[donorIndex]);
        if (borrowed) {
          buckets[index + 1].paths.push(borrowed);
          buckets[index + 1].score += borrowed.score;
          buckets[index + 1].cells.add(computeCellKey(borrowed.geometry, globalBounds));
        }
      }
      continue;
    }

    let donorIndex = -1;
    for (let candidate = buckets.length - 1; candidate >= 0; candidate -= 1) {
      if (buckets[candidate].paths.length > 1) {
        donorIndex = candidate;
        break;
      }
    }

    if (donorIndex >= 0) {
      const borrowed = takeSmallestPath(buckets[donorIndex]);
      if (borrowed) {
        buckets[index].paths.push(borrowed);
        buckets[index].score += borrowed.score;
        buckets[index].cells.add(computeCellKey(borrowed.geometry, globalBounds));
      }
    }
  }

  const movePath = (fromIndex, toIndex) => {
    const from = buckets[fromIndex];
    const to = buckets[toIndex];
    if (!from || !to || from.paths.length <= 1) {
      return false;
    }

    let candidateIndex = -1;
    let candidateScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < from.paths.length; index += 1) {
      const item = from.paths[index];
      if (item.score < candidateScore) {
        candidateScore = item.score;
        candidateIndex = index;
      }
    }

    if (candidateIndex < 0) {
      return false;
    }

    const [candidate] = from.paths.splice(candidateIndex, 1);
    from.score -= candidate.score;
    to.paths.push(candidate);
    to.score += candidate.score;

    from.cells = new Set(from.paths.map((path) => computeCellKey(path.geometry, globalBounds)));
    to.cells.add(computeCellKey(candidate.geometry, globalBounds));
    return true;
  };

  for (let pass = 0; pass < 24; pass += 1) {
    let changed = false;
    for (let index = 0; index < buckets.length - 1; index += 1) {
      const bucket = buckets[index];
      const nextBucket = buckets[index + 1];
      const high = bucket.target * 1.18;
      const low = nextBucket.target * 0.82;
      if (bucket.score > high && nextBucket.score < low) {
        changed = movePath(index, index + 1) || changed;
      }
    }
    if (!changed) {
      break;
    }
  }

  const minBucketShare = incrementRatios.map((ratio) => ratio * 0.72);

  const moveFromDonorToBucket = (toIndex) => {
    let donorIndex = -1;
    let donorScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < buckets.length; index += 1) {
      if (index === toIndex) continue;
      const minKeep = minBucketShare[index] * totalScore;
      const excess = buckets[index].score - minKeep;
      if (buckets[index].paths.length > 1 && excess > donorScore) {
        donorScore = excess;
        donorIndex = index;
      }
    }
    if (donorIndex < 0 || donorScore <= 0) {
      return false;
    }
    return movePath(donorIndex, toIndex);
  };

  for (let index = 0; index < buckets.length; index += 1) {
    const minRequired = minBucketShare[index] * totalScore;
    let guard = 0;
    while (buckets[index].score < minRequired && guard < 80) {
      const moved = moveFromDonorToBucket(index);
      if (!moved) break;
      guard += 1;
    }
  }

  const finalIndex = buckets.length - 1;
  const finalMinimum = incrementRatios[finalIndex] * totalScore * 0.9;
  let finalGuard = 0;
  while (buckets[finalIndex].score < finalMinimum && finalGuard < 80) {
    if (!moveFromDonorToBucket(finalIndex)) {
      break;
    }
    finalGuard += 1;
  }

  return buckets;
};

const splitIntoStages = (orderedPaths, count) => {
  if (orderedPaths.length === 0) {
    return Array.from({ length: count }, () => []);
  }

  const safePaths = orderedPaths.map((path) => ({
    d: path.d,
    score: Number.isFinite(path.score) && path.score > 0 ? path.score : 1,
    style: path.style && typeof path.style === "object" ? path.style : {},
    fillOnly: Boolean(path.fillOnly),
    groupId: typeof path.groupId === "string" ? path.groupId : path.d,
  }));

  const buckets = assignPathsToBuckets(safePaths, count);
  const groupSortIndex = new Map();
  const groupFullD = new Map();
  const groupTotals = new Map();
  const groupFillOnly = new Map();
  safePaths.forEach((path, index) => {
    if (!groupSortIndex.has(path.groupId)) {
      groupSortIndex.set(path.groupId, index);
    }
    groupTotals.set(path.groupId, (groupTotals.get(path.groupId) ?? 0) + 1);
    groupFullD.set(path.groupId, `${groupFullD.get(path.groupId) ?? ""} ${path.d}`.trim());
    if (!groupFillOnly.has(path.groupId)) {
      groupFillOnly.set(path.groupId, Boolean(path.fillOnly));
    }
  });

  const collapseByGroup = (paths) => {
    const grouped = new Map();
    for (const path of paths) {
      const entry = grouped.get(path.groupId) ?? { groupId: path.groupId, style: path.style, parts: [] };
      entry.parts.push(path.d);
      grouped.set(path.groupId, entry);
    }
    const ordered = Array.from(grouped.values()).sort(
      (a, b) => (groupSortIndex.get(a.groupId) ?? 0) - (groupSortIndex.get(b.groupId) ?? 0),
    );
    return ordered.map((entry) => {
      const totalParts = groupTotals.get(entry.groupId) ?? entry.parts.length;
      const complete = entry.parts.length >= totalParts;
      const fillOnly = groupFillOnly.get(entry.groupId) ?? false;
      return toStageSegment(
        { d: entry.parts.join(" "), style: entry.style },
        1,
        {
          id: entry.groupId,
          complete,
          fillOnly,
          fullD: groupFullD.get(entry.groupId) ?? entry.parts.join(" "),
        },
      );
    });
  };

  return buckets.map((bucket) => collapseByGroup(bucket.paths));
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
    .path { stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: draw .8s ease forwards; }
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
      const current = Array.isArray(stages[visible - 1]) ? stages[visible - 1] : [];
      svg.innerHTML = current.map((segment, i) => {
        const d = typeof segment === 'string' ? segment : segment.d;
        const style = (typeof segment === 'object' && segment && typeof segment.style === 'object') ? segment.style : {};
        const metaFillOnly = typeof segment === 'object' && segment ? segment.fillOnly : undefined;
        const fullD = (typeof segment === 'object' && segment && typeof segment.fullD === 'string' && segment.fullD) ? segment.fullD : d;
        const fill = typeof style.fill === 'string' ? style.fill : 'none';
        const stroke = typeof style.stroke === 'string' ? style.stroke : '#0e4e7f';
        const strokeWidth = typeof style['stroke-width'] === 'string' ? style['stroke-width'] : '7';
        const linecap = typeof style['stroke-linecap'] === 'string' ? style['stroke-linecap'] : 'round';
        const linejoin = typeof style['stroke-linejoin'] === 'string' ? style['stroke-linejoin'] : 'round';
        const opacity = typeof style.opacity === 'string' ? style.opacity : '1';
        const fillOpacity = typeof style['fill-opacity'] === 'string' ? style['fill-opacity'] : '1';
        const strokeOpacity = typeof style['stroke-opacity'] === 'string' ? style['stroke-opacity'] : '1';
        const fillRule = typeof style['fill-rule'] === 'string' ? style['fill-rule'] : 'evenodd';
        const to = typeof segment === 'string' ? 1 : Math.max(0.001, Math.min(1, Number(segment.to ?? 1)));
        const fillOnly = typeof metaFillOnly === 'boolean'
          ? metaFillOnly
          : String(stroke).toLowerCase() === 'none' && String(fill).toLowerCase() !== 'none';
        if (fillOnly) {
          const maskId = 'mask-' + visible + '-' + i;
          return '<defs><mask id="' + maskId + '" maskUnits="userSpaceOnUse"><rect x="-10000" y="-10000" width="20000" height="20000" fill="black" /><path d="' + d.replaceAll('"', '&quot;') + '" fill="white" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill-rule="' + fillRule + '" /></mask></defs><path class="path" d="' + fullD.replaceAll('"', '&quot;') + '" fill="' + fill + '" fill-rule="' + fillRule + '" stroke="none" opacity="' + opacity + '" fill-opacity="' + fillOpacity + '" mask="url(#' + maskId + ')" style="animation-delay:' + (i * 45) + 'ms" />';
        }
        return '<path class="path" d="' + d.replaceAll('"', '&quot;') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" stroke-linecap="' + linecap + '" stroke-linejoin="' + linejoin + '" opacity="' + opacity + '" fill-opacity="' + fillOpacity + '" stroke-opacity="' + strokeOpacity + '" pathLength="1" style="stroke-dasharray:' + to + ' 1;animation-delay:' + (i * 45) + 'ms" />';
      }).join('');
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

const filteredFiles = slugFilter
  ? files.filter((filePath) => basename(filePath, extname(filePath)).toLowerCase() === slugFilter)
  : files;

if (slugFilter && filteredFiles.length === 0) {
  throw new Error(`Could not find raw doodle SVG for slug "${slugFilter}"`);
}

const manifest = [];

for (const filePath of filteredFiles) {
  const filename = basename(filePath);
  const slug = basename(filename, extname(filename));
  const svg = readFileSync(filePath, "utf8");

  const viewBox = parseViewBox(svg);
  const rawPaths = extractPaths(svg);

  if (rawPaths.length === 0) {
    console.warn(`Skipping ${filename}: no <path d="..."> elements found.`);
    continue;
  }

  const orderedPaths = maybeShufflePaths(orderPaths(rawPaths));
  const stages = splitIntoStages(orderedPaths, stageCount);

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

const manifestPath = join(outputDir, "puzzles.generated.json");
let manifestItems = manifest;

if (slugFilter) {
  const existingManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { items: [] };
  const existingItems = Array.isArray(existingManifest?.items) ? existingManifest.items : [];
  const bySlug = new Map(existingItems.map((item) => [item.slug, item]));
  for (const item of manifest) {
    bySlug.set(item.slug, item);
  }
  manifestItems = Array.from(bySlug.values()).sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
}

writeFileSync(
  manifestPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), strategy, stageCount, items: manifestItems }, null, 2)}\n`,
  "utf8",
);

console.log(`Generated ${manifest.length} doodle file(s).`);
console.log(`JSON output: ${outputDir}`);
console.log(`Preview output: ${previewDir}`);
