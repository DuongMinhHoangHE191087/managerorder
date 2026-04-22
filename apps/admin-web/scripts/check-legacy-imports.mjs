import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = "src";
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const LEGACY_PATTERNS = [/@\/components\//, /@\/lib\/hooks\//];
const BOUNDARY_RULES = [
  {
    layer: "src/shared/",
    disallowed: ["src/features/", "src/widgets/", "src/app/"],
    message: "shared layer must not depend on features, widgets, or app",
  },
  {
    layer: "src/entities/",
    disallowed: ["src/features/", "src/widgets/", "src/app/"],
    message: "entities layer must not depend on features, widgets, or app",
  },
  {
    layer: "src/features/",
    disallowed: ["src/widgets/", "src/app/"],
    message: "features layer must not depend on widgets or app",
  },
];
const FILE_BOUNDARY_RULES = [
  {
    filePrefix: "src/app/api/orders/[id]/refunds/",
    disallowed: [
      "src/lib/supabase/repositories/refund-requests.repo",
      "src/lib/domain/refund-policy",
      "src/lib/domain/sales-workflow-guards",
    ],
    message: "refund order route must depend on domains/orders service instead of raw workflow internals",
  },
  {
    filePrefix: "src/app/api/orders/[id]/renew/",
    disallowed: [
      "src/lib/supabase/repositories/orders.repo",
      "src/lib/supabase/repositories/order-status-history.repo",
      "src/lib/domain/sales-workflow-guards",
    ],
    message: "renew order route must depend on domains/orders service instead of raw workflow internals",
  },
];

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractSpecifier(line) {
  const match = line.match(/^\s*(?:import|export)\b.*?(?:from\s+)?["']([^"']+)["']/);
  return match?.[1] ?? null;
}

function resolveProjectImport(filePath, specifier) {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }

  if (specifier.startsWith(".")) {
    const absoluteTarget = path.resolve(path.dirname(filePath), specifier);
    const relativeTarget = normalizePath(path.relative(process.cwd(), absoluteTarget));
    return relativeTarget.startsWith("src/") ? relativeTarget : null;
  }

  return null;
}

function collectViolations(files) {
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file);
    const layerRule = BOUNDARY_RULES.find((rule) => filePath.startsWith(rule.layer));
    const fileRule = FILE_BOUNDARY_RULES.find((rule) => filePath.startsWith(rule.filePrefix));
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      const specifier = extractSpecifier(line);
      if (!specifier) {
        return;
      }

      if (LEGACY_PATTERNS.some((pattern) => pattern.test(specifier))) {
        violations.push(`${filePath}:${index + 1}: legacy import "${specifier}"`);
        return;
      }

      if (fileRule) {
        const target = resolveProjectImport(filePath, specifier);
        if (target && fileRule.disallowed.some((prefix) => target.startsWith(prefix))) {
          violations.push(
            `${filePath}:${index + 1}: ${fileRule.message} -> "${specifier}" resolves to "${target}"`
          );
          return;
        }
      }

      if (!layerRule) {
        return;
      }

      const target = resolveProjectImport(filePath, specifier);
      if (!target) {
        return;
      }

      const disallowedPrefix = layerRule.disallowed.find((prefix) => target.startsWith(prefix));
      if (disallowedPrefix) {
        violations.push(
          `${filePath}:${index + 1}: ${layerRule.message} -> "${specifier}" resolves to "${target}"`
        );
      }
    });
  }

  return violations;
}

const files = walk(SOURCE_ROOT);
const violations = collectViolations(files);

if (violations.length > 0) {
  console.error("Import boundary violations detected:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log("No legacy import paths or boundary violations found.");
