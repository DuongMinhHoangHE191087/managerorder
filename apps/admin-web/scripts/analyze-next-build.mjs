import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const appServerDir = path.join(nextDir, "server", "app");

if (!fs.existsSync(nextDir)) {
  console.error("Missing .next directory. Run `npm run build` before analyzing.");
  process.exit(1);
}

if (!fs.existsSync(appServerDir)) {
  console.error("Missing .next/server/app directory. This script expects an App Router build.");
  process.exit(1);
}

const COMMON_ENTRY_KEYS = new Set([
  "[project]/src/app/layout",
  "[project]/src/app/error",
  "[project]/src/app/loading",
  "[project]/src/app/template",
  "[project]/src/app/not-found",
  "[project]/node_modules/next/dist/client/components/builtin/global-error",
]);

function walk(dir, matcher, bucket = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, bucket);
    } else if (matcher(fullPath)) {
      bucket.push(fullPath);
    }
  }
  return bucket;
}

function parseClientReferenceManifest(filePath) {
  const content = fs.readFileSync(filePath, "utf8").trim();
  const match = content.match(/globalThis\.__RSC_MANIFEST\["[\s\S]*?"\]\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) {
    throw new Error(`Unable to parse manifest JSON from ${filePath}`);
  }

  return JSON.parse(match[1]);
}

function parseJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function routeFromManifestPath(filePath) {
  const relative = path.relative(appServerDir, filePath).replace(/\\/g, "/");
  const route = relative.replace(/\/?page_client-reference-manifest\.js$/, "");
  return route.length > 0 ? `/${route}` : "/";
}

function normalizeBuildPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/_next/")) {
    return normalized.slice("/_next/".length);
  }
  if (normalized.startsWith("_next/")) {
    return normalized.slice("_next/".length);
  }
  if (normalized.startsWith("/")) {
    return normalized.slice(1);
  }
  return normalized;
}

function unique(items) {
  return [...new Set(items)];
}

function fileSize(filePath) {
  const normalized = normalizeBuildPath(filePath);
  const absolute = path.join(nextDir, normalized);
  if (!fs.existsSync(absolute)) {
    return 0;
  }
  return fs.statSync(absolute).size;
}

function sumSizes(filePaths) {
  return filePaths.reduce((total, filePath) => total + fileSize(filePath), 0);
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function pickRouteEntryKey(entryJSFiles) {
  const keys = Object.keys(entryJSFiles ?? {});
  const routeKeys = keys
    .filter((key) => key.startsWith("[project]/src/app/") && key.endsWith("/page"))
    .filter((key) => !COMMON_ENTRY_KEYS.has(key));

  return routeKeys.sort((left, right) => right.length - left.length)[0] ?? "[project]/src/app/page";
}

function chunkReport(filePaths) {
  return unique(filePaths)
    .map((filePath) => ({
      filePath,
      size: fileSize(filePath),
    }))
    .sort((left, right) => right.size - left.size);
}

const topLevelBuildManifest = parseJsonFile(path.join(nextDir, "build-manifest.json"));
const globalRootFiles = unique([
  ...(topLevelBuildManifest.polyfillFiles ?? []),
  ...(topLevelBuildManifest.rootMainFiles ?? []),
]);

const manifestFiles = walk(
  appServerDir,
  (filePath) => filePath.endsWith("page_client-reference-manifest.js"),
);

const routeReports = manifestFiles.map((manifestPath) => {
  const route = routeFromManifestPath(manifestPath);
  const manifest = parseClientReferenceManifest(manifestPath);
  const entryJSFiles = manifest.entryJSFiles ?? {};
  const entryCSSFiles = manifest.entryCSSFiles ?? {};
  const routeEntryKey = pickRouteEntryKey(entryJSFiles);
  const layoutEntry = unique(entryJSFiles["[project]/src/app/layout"] ?? []);
  const routeEntry = unique(entryJSFiles[routeEntryKey] ?? []);
  const routeInitialExtra = routeEntry.filter((filePath) => !layoutEntry.includes(filePath));
  const routeCssEntry = (entryCSSFiles[routeEntryKey] ?? []).map((entry) => entry.path);

  const reactLoadablePath = path.join(path.dirname(manifestPath), "page", "react-loadable-manifest.json");
  const reactLoadableManifest = fs.existsSync(reactLoadablePath)
    ? parseJsonFile(reactLoadablePath)
    : {};
  const lazyFiles = unique(
    Object.values(reactLoadableManifest)
      .flatMap((entry) => entry.files ?? [])
      .filter((filePath) => filePath.endsWith(".js"))
      .filter((filePath) => !routeEntry.includes(filePath) && !layoutEntry.includes(filePath)),
  );

  return {
    route,
    routeEntryKey,
    initialSharedJs: sumSizes(layoutEntry),
    initialRouteJs: sumSizes(routeEntry),
    initialRouteExtraJs: sumSizes(routeInitialExtra),
    initialCss: sumSizes(routeCssEntry),
    lazyJs: sumSizes(lazyFiles),
    initialChunks: chunkReport(routeEntry),
    initialExtraChunks: chunkReport(routeInitialExtra),
    lazyChunks: chunkReport(lazyFiles),
  };
});

const topInitialRoutes = [...routeReports]
  .sort((left, right) => right.initialRouteJs - left.initialRouteJs)
  .slice(0, 8);

const topLazyRoutes = [...routeReports]
  .filter((report) => report.lazyJs > 0)
  .sort((left, right) => right.lazyJs - left.lazyJs)
  .slice(0, 8);

const topGlobalChunks = chunkReport(globalRootFiles).slice(0, 10);

console.log("Next Build Analysis");
console.log("===================");
console.log(`Shared root JS: ${formatKb(sumSizes(globalRootFiles))} across ${globalRootFiles.length} files`);
console.log("");
console.log("Top Routes By Initial JS");
for (const [index, report] of topInitialRoutes.entries()) {
  const biggestExtra = report.initialExtraChunks.slice(0, 3)
    .map((chunk) => `${path.basename(chunk.filePath)} (${formatKb(chunk.size)})`)
    .join(", ");

  console.log(
    `${index + 1}. ${report.route} -> ${formatKb(report.initialRouteJs)} initial JS ` +
      `(${formatKb(report.initialRouteExtraJs)} route-specific, ${formatKb(report.initialSharedJs)} shared), ` +
      `${formatKb(report.lazyJs)} lazy JS, ${formatKb(report.initialCss)} CSS`,
  );
  if (biggestExtra) {
    console.log(`   Biggest route chunks: ${biggestExtra}`);
  }
}

if (topLazyRoutes.length > 0) {
  console.log("");
  console.log("Top Routes By Lazy JS");
  for (const [index, report] of topLazyRoutes.entries()) {
    const biggestLazy = report.lazyChunks.slice(0, 3)
      .map((chunk) => `${path.basename(chunk.filePath)} (${formatKb(chunk.size)})`)
      .join(", ");

    console.log(`${index + 1}. ${report.route} -> ${formatKb(report.lazyJs)} lazy JS`);
    if (biggestLazy) {
      console.log(`   Lazy chunks: ${biggestLazy}`);
    }
  }
}

console.log("");
console.log("Top Shared Root Chunks");
for (const [index, chunk] of topGlobalChunks.entries()) {
  console.log(`${index + 1}. ${path.basename(chunk.filePath)} -> ${formatKb(chunk.size)}`);
}
