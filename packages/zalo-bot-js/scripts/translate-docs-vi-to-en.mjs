import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import translate from "translate-google";

const workspaceRoot = process.cwd();
const sourceDir = resolve(workspaceRoot, "docs/vi");
const targetDir = resolve(workspaceRoot, "docs/en");
const cacheDir = resolve(workspaceRoot, ".tmp");
const cachePath = resolve(cacheDir, "translate-cache-en.json");

async function main() {
  const cache = await loadCache();
  const files = await collectMarkdownFiles(sourceDir);

  for (const file of files) {
    const relativePath = relative(sourceDir, file);
    const outputPath = join(targetDir, relativePath);
    const content = await readFile(file, "utf8");
    const translated = await translateMarkdown(content, cache);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, translated, "utf8");
    console.log(`Translated ${relativePath}`);
  }

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function translateMarkdown(markdown, cache) {
  const protectedSegments = [];
  let protectedMarkdown = markdown.replace(
    /```[\s\S]*?```|`[^`\n]+`/g,
    (match) => createPlaceholder(match, protectedSegments),
  );

  const lines = protectedMarkdown.split(/\r?\n/);
  const translatedLines = [];

  for (const line of lines) {
    if (!line.trim()) {
      translatedLines.push("");
      continue;
    }

    if (shouldKeepLine(line)) {
      translatedLines.push(line);
      continue;
    }

    const translatedLine = await translateWithCache(line, cache);
    translatedLines.push(translatedLine);
  }

  return restorePlaceholders(translatedLines.join("\n"), protectedSegments);
}

function shouldKeepLine(line) {
  if (/^\s*(---|\*\*\*|\|.*\|)\s*$/.test(line)) {
    return true;
  }

  if (/^\s*```/.test(line)) {
    return true;
  }

  return false;
}

function createPlaceholder(content, protectedSegments) {
  const key = `__PROTECTED_${protectedSegments.length}__`;
  protectedSegments.push(content);
  return key;
}

function restorePlaceholders(content, protectedSegments) {
  return protectedSegments.reduce(
    (result, segment, index) => result.replaceAll(`__PROTECTED_${index}__`, segment),
    content,
  );
}

async function translateWithCache(text, cache) {
  if (cache[text]) {
    return cache[text];
  }

  const translated = await translate(text, {
    from: "vi",
    to: "en",
  });
  cache[text] = translated;
  return translated;
}

async function loadCache() {
  try {
    const file = await readFile(cachePath, "utf8");
    return JSON.parse(file);
  } catch {
    return {};
  }
}

void main().catch((error) => {
  console.error("translate-docs failed");
  console.error(error);
  process.exitCode = 1;
});
