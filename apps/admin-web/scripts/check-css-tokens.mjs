import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const FILE_PATTERN = /\.(ts|tsx|css)$/;
const GLOBAL_CSS_PATH = path.join(SOURCE_ROOT, "app", "globals.css");
const ALLOWED_PREFIXES = ["radix-"];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

const globalsCss = fs.readFileSync(GLOBAL_CSS_PATH, "utf8");
const definedTokens = new Set(
  [...globalsCss.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]),
);

const violations = [];

for (const file of walk(SOURCE_ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/var\(--([a-zA-Z0-9-]+)\)/g)) {
      const token = match[1];
      const isAllowed = ALLOWED_PREFIXES.some((prefix) => token.startsWith(prefix));

      if (!definedTokens.has(token) && !isAllowed) {
        violations.push(`${file}:${index + 1}: undefined CSS token --${token}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Undefined CSS tokens detected:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log("All CSS tokens resolve to globals.css definitions.");
