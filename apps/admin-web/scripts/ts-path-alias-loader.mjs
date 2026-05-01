import { existsSync, statSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];

function resolveProjectRoot() {
  const cwd = process.cwd();
  // In Docker/Monorepo root, the actual app source is in apps/admin-web
  const adminWebPath = path.resolve(cwd, "apps/admin-web");
  if (existsSync(path.join(adminWebPath, "package.json"))) {
    return adminWebPath;
  }
  return cwd;
}

function resolveCandidate(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) {
    return pathToFileURL(basePath).href;
  }

  for (const extension of EXTENSIONS) {
    const withExtension = `${basePath}${extension}`;
    if (existsSync(withExtension) && statSync(withExtension).isFile()) {
      return pathToFileURL(withExtension).href;
    }
  }

  if (existsSync(basePath) && statSync(basePath).isDirectory()) {
    for (const extension of EXTENSIONS) {
      const indexPath = path.join(basePath, `index${extension}`);
      if (existsSync(indexPath) && statSync(indexPath).isFile()) {
        return pathToFileURL(indexPath).href;
      }
    }
  }

  return null;
}

function resolveRelativeOrAbsolute(specifier, parentURL) {
  const parentPath = parentURL ? fileURLToPath(parentURL) : resolveProjectRoot();
  const basePath = path.isAbsolute(specifier)
    ? specifier
    : path.resolve(path.dirname(parentPath), specifier);

  return resolveCandidate(basePath);
}

function resolveAlias(specifier) {
  const basePath = path.resolve(resolveProjectRoot(), "src", specifier.slice(2));
  return resolveCandidate(basePath);
}

export async function resolve(specifier, context, defaultResolve) {
  if (
    specifier.startsWith("file:") ||
    specifier.startsWith("data:") ||
    specifier.startsWith("node:")
  ) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  if (specifier.startsWith("@/")) {
    const resolved = resolveAlias(specifier);
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }

  if (specifier.startsWith("next/")) {
    const resolved = resolveCandidate(path.resolve(resolveProjectRoot(), "node_modules", specifier));
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }

  if (path.isAbsolute(specifier) || specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/")) {
    const resolved = resolveRelativeOrAbsolute(specifier, context.parentURL);
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
