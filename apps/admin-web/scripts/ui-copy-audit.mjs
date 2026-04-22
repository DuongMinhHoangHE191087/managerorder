import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOTS = [
  path.join(process.cwd(), "src/app"),
  path.join(process.cwd(), "src/widgets"),
  path.join(process.cwd(), "src/shared"),
];

const FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs)$/;
const IGNORE_DIR_FRAGMENTS = [
  "/node_modules/",
  "/.next/",
  "/dist/",
  "/coverage/",
  "/qa-artifacts/",
  "/src/shared/messages/",
  "/src/app/api/",
];

const TEXT_ATTR_NAMES = new Set([
  "aria-label",
  "ariaLabel",
  "confirmLabel",
  "description",
  "desc",
  "emptyText",
  "helperText",
  "label",
  "name",
  "placeholder",
  "prompt",
  "resetLabel",
  "subTitle",
  "subtitle",
  "successLabel",
  "tab",
  "text",
  "title",
  "tooltip",
]);

const TEXT_PROP_NAMES = new Set([
  "ariaLabel",
  "confirmLabel",
  "description",
  "desc",
  "emptyText",
  "helperText",
  "label",
  "message",
  "name",
  "placeholder",
  "prompt",
  "resetLabel",
  "subTitle",
  "subtitle",
  "success",
  "tab",
  "text",
  "title",
  "tooltip",
]);

const TECHNICAL_PROP_NAMES = new Set([
  "as",
  "background",
  "backgroundColor",
  "border",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "boxShadow",
  "className",
  "color",
  "d",
  "fill",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "gradient",
  "height",
  "href",
  "id",
  "margin",
  "media",
  "padding",
  "rel",
  "role",
  "shadow",
  "size",
  "src",
  "stroke",
  "style",
  "target",
  "type",
  "variant",
  "viewBox",
  "width",
  "WebkitBackdropFilter",
  "backdropFilter",
]);

const TECHNICAL_CALLS = new Set([
  "cn",
  "clsx",
  "cva",
  "twMerge",
  "buttonVariants",
  "format",
  "path.join",
]);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const normalized = normalizePath(fullPath);

    if (IGNORE_DIR_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (entry.isFile() && FILE_PATTERN.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnoreLiteral(literal) {
  const value = literal.trim();
  return (
    value.length === 0 ||
    value.length < 2 ||
    value === "use client" ||
    value === "use server" ||
    /^[@./]/.test(value) ||
    /^\/[A-Za-z0-9/_-]*$/.test(value) ||
    /^[a-z0-9_./:-]+$/.test(value) ||
    /^[A-Z0-9_./:-]+$/.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^[0-9]+([.,][0-9]+)?$/.test(value) ||
    /(?:\b(?:bg|text|flex|grid|rounded|shadow|animate|border|ring|space|gap|px|py|pt|pr|pb|pl|mx|my|mt|mr|mb|ml|items|justify|content|self|grow|shrink|overflow|relative|absolute|fixed|sticky|inset|z|font|tracking|uppercase|lowercase|normal-case|hover|focus|active|disabled|from|to|via|opacity|transition|cursor|min|max)-(?:[\w\[\]\/%.-]+))/i.test(value) ||
    /\b(?:var|rgba?|hsla?|linear-gradient|radial-gradient|calc|clamp)\(/i.test(value)
  );
}

function looksLikeCopy(literal) {
  const value = literal.trim();
  if (shouldIgnoreLiteral(value)) {
    return false;
  }

  return /[À-ỹ]/.test(value) || /\s/.test(value) || /^[A-Z][\wÀ-ỹ.-]*$/.test(value) || /[!?.,:]/.test(value);
}

function getLineAndColumn(sourceFile, node) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: pos.line + 1, column: pos.character + 1 };
}

function getParentLabel(node) {
  const parent = node.parent;
  if (!parent) {
    return "unknown";
  }

  switch (parent.kind) {
    case ts.SyntaxKind.JsxAttribute:
      return `jsx-attr:${parent.name.getText()}`;
    case ts.SyntaxKind.PropertyAssignment:
      return `prop:${parent.name.getText()}`;
    case ts.SyntaxKind.CallExpression: {
      const expression = parent.expression.getText();
      return `call:${expression}`;
    }
    case ts.SyntaxKind.VariableDeclaration:
      return `var:${parent.name.getText()}`;
    default:
      return ts.SyntaxKind[parent.kind] ?? "unknown";
  }
}

function collectFileFindings(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const scriptKind = filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : filePath.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const findings = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).replace(/\s+/g, " ").trim();
      if (looksLikeCopy(text)) {
        const position = getLineAndColumn(sourceFile, node);
        findings.push({
          kind: "jsx-text",
          line: position.line,
          column: position.column,
          parent: getParentLabel(node),
          text,
        });
      }
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text.trim();
      const parentKind = node.parent ? node.parent.kind : undefined;
      const skipParent =
        parentKind === ts.SyntaxKind.ImportDeclaration ||
        parentKind === ts.SyntaxKind.ImportEqualsDeclaration ||
        parentKind === ts.SyntaxKind.ExportDeclaration ||
        parentKind === ts.SyntaxKind.ModuleDeclaration ||
        parentKind === ts.SyntaxKind.LiteralTypeNode ||
        parentKind === ts.SyntaxKind.TypeReferenceNode ||
        parentKind === ts.SyntaxKind.ExpressionWithTypeArguments;

      const parentName =
        ts.isJsxAttribute(node.parent) ? node.parent.name.getText() :
        ts.isPropertyAssignment(node.parent) ? node.parent.name.getText() :
        ts.isCallExpression(node.parent) ? node.parent.expression.getText() :
        undefined;

      const technical =
        (parentName && TECHNICAL_PROP_NAMES.has(parentName)) ||
        (parentName && TECHNICAL_CALLS.has(parentName)) ||
        (parentKind === ts.SyntaxKind.ExpressionStatement && (text === "use client" || text === "use server"));

      if (!skipParent && !technical && looksLikeCopy(text)) {
        const position = getLineAndColumn(sourceFile, node);
        findings.push({
          kind: ts.SyntaxKind[node.kind] ?? "string",
          line: position.line,
          column: position.column,
          parent: getParentLabel(node),
          text,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

const files = ROOTS.flatMap((root) => walk(root));
const findings = files.flatMap((file) =>
  collectFileFindings(file).map((finding) => ({
    file: normalizePath(file),
    ...finding,
  }))
);

findings.sort((a, b) =>
  a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.text.localeCompare(b.text)
);

const byFile = new Map();
for (const finding of findings) {
  if (!byFile.has(finding.file)) {
    byFile.set(finding.file, []);
  }
  byFile.get(finding.file).push(finding);
}

if (findings.length === 0) {
  console.log("No suspicious UI copy candidates detected.");
  process.exit(0);
}

console.log(`Suspicious UI copy candidates: ${findings.length}`);
for (const [file, rows] of byFile) {
  console.log(`\n${file}`);
  for (const row of rows.slice(0, 25)) {
    console.log(`  ${row.line}:${row.column} [${row.kind}] ${row.parent} => ${row.text}`);
  }
  if (rows.length > 25) {
    console.log(`  ... ${rows.length - 25} more`);
  }
}
