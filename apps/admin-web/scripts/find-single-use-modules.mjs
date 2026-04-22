import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (sourceExtensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveModule(basePath, fileSet) {
  const candidates = [basePath];

  for (const ext of sourceExtensions) {
    candidates.push(`${basePath}${ext}`);
    candidates.push(path.join(basePath, `index${ext}`));
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fileSet.has(resolved)) {
      return resolved;
    }
  }

  return null;
}

function collectImports(fileText) {
  const importSources = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(fileText))) {
      importSources.add(match[1]);
    }
  }

  return [...importSources];
}

const allFiles = walk(srcRoot);
const fileSet = new Set(allFiles.map((file) => path.resolve(file)));
const incoming = new Map();

for (const file of allFiles) {
  const text = fs.readFileSync(file, "utf8");
  const consumerSet = new Set();

  for (const source of collectImports(text)) {
    let resolved = null;

    if (source.startsWith("@/")) {
      resolved = resolveModule(path.join(srcRoot, source.slice(2)), fileSet);
    } else if (source.startsWith(".")) {
      resolved = resolveModule(path.resolve(path.dirname(file), source), fileSet);
    }

    if (resolved && resolved !== path.resolve(file)) {
      consumerSet.add(resolved);
    }
  }

  for (const resolved of consumerSet) {
    if (!incoming.has(resolved)) {
      incoming.set(resolved, new Set());
    }

    incoming.get(resolved).add(path.resolve(file));
  }
}

const targets = allFiles
  .filter((file) => {
    const normalized = path.resolve(file).split(path.sep).join("/");
    return normalized.includes("/src/shared/ui/") || normalized.includes("/src/features/");
  })
  .map((file) => {
    const resolved = path.resolve(file);
    const consumers = [...(incoming.get(resolved) ?? new Set())].sort();
    return {
      file: path.relative(root, resolved).split(path.sep).join("/"),
      consumerCount: consumers.length,
      consumers: consumers.map((consumer) => path.relative(root, consumer).split(path.sep).join("/")),
    };
  })
  .filter((entry) => entry.consumerCount === 1)
  .sort((a, b) => a.file.localeCompare(b.file));

for (const entry of targets) {
  console.log(`${entry.file}\t${entry.consumers[0]}`);
}
