import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.join(process.cwd(), "src");
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const SAFE_SERVER_ENV = new Set(["NODE_ENV", "NEXT_RUNTIME"]);

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

function isClientModule(text) {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }

    if (
      trimmed === '"use client";' ||
      trimmed === "'use client';" ||
      trimmed === '"use client"' ||
      trimmed === "'use client'"
    ) {
      return true;
    }

    return false;
  }

  return false;
}

function extractImports(text) {
  const imports = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:import|export)\b.*?(?:from\s+)?["']([^"']+)["']/);
    if (!match) {
      return;
    }

    imports.push({
      specifier: match[1],
      line: index + 1,
      isTypeOnly: /^\s*(?:import|export)\s+type\b/.test(line),
    });
  });

  return imports;
}

function extractSecretEnvUses(text) {
  return [...text.matchAll(/\bprocess\.env\.([A-Z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("NEXT_PUBLIC_") && !SAFE_SERVER_ENV.has(name));
}

function buildCandidatePaths(projectPath) {
  const candidates = [projectPath];

  if (!path.extname(projectPath)) {
    candidates.push(`${projectPath}.ts`, `${projectPath}.tsx`);
    candidates.push(
      path.join(projectPath, "index.ts"),
      path.join(projectPath, "index.tsx"),
    );
  }

  return candidates.map(normalizePath);
}

function resolveProjectImport(filePath, specifier, fileSet) {
  let basePath = null;

  if (specifier.startsWith("@/")) {
    basePath = path.join("src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    basePath = path.relative(
      process.cwd(),
      path.resolve(path.dirname(filePath), specifier),
    );
  }

  if (!basePath) {
    return null;
  }

  const normalizedBasePath = normalizePath(basePath);
  const resolved = buildCandidatePaths(normalizedBasePath).find((candidate) =>
    fileSet.has(candidate),
  );

  return resolved ?? null;
}

function describeServerOnlyReason(moduleInfo) {
  if (moduleInfo.hasServerOnlyImport) {
    return 'imports "server-only"';
  }

  if (moduleInfo.secretEnvUses.length > 0) {
    return `uses secret env (${moduleInfo.secretEnvUses.join(", ")})`;
  }

  if (moduleInfo.importsSupabaseAdmin) {
    return "imports supabase admin/server client";
  }

  return "is marked server-only";
}

const files = walk(SOURCE_ROOT).map(normalizePath);
const fileSet = new Set(files);
const modules = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const imports = extractImports(text);
  const secretEnvUses = extractSecretEnvUses(text);
  const hasServerOnlyImport = imports.some(
    (entry) => entry.specifier === "server-only",
  );
  const importsSupabaseAdmin = imports.some((entry) =>
    [
      "@/lib/supabase/admin",
      "@/lib/supabase/server",
      "@/lib/api/with-account",
    ].includes(entry.specifier),
  );
  const dependencies = imports
    .filter((entry) => !entry.isTypeOnly)
    .map((entry) => ({
      line: entry.line,
      specifier: entry.specifier,
      target: resolveProjectImport(file, entry.specifier, fileSet),
    }))
    .filter((entry) => entry.target);

  modules.set(file, {
    file,
    isClient: isClientModule(text),
    hasServerOnlyImport,
    importsSupabaseAdmin,
    secretEnvUses,
    isServerOnly:
      hasServerOnlyImport || importsSupabaseAdmin || secretEnvUses.length > 0,
    dependencies,
  });
}

const violations = [];

for (const moduleInfo of modules.values()) {
  if (!moduleInfo.isClient) {
    continue;
  }

  const queue = [{ file: moduleInfo.file, chain: [moduleInfo.file] }];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.file)) {
      continue;
    }

    visited.add(current.file);
    const currentModule = modules.get(current.file);
    if (!currentModule) {
      continue;
    }

    if (currentModule.isServerOnly) {
      violations.push(
        `${current.chain.join(" -> ")} (${describeServerOnlyReason(currentModule)})`,
      );
      continue;
    }

    for (const dependency of currentModule.dependencies) {
      queue.push({
        file: dependency.target,
        chain: [...current.chain, dependency.target],
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Client/server boundary violations detected:");
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}

console.log("No client modules import server-only code.");
