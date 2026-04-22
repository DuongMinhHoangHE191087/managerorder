import fs from "node:fs";
import path from "node:path";

const ROOTS = [
  path.join(process.cwd(), "src/app"),
  path.join(process.cwd(), "src/widgets"),
  path.join(process.cwd(), "src/shared"),
];

const FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs)$/;
const IGNORE_DIR_FRAGMENTS = ["/node_modules/", "/.next/", "/src/app/api/", "/src/shared/messages/"];
const BANNED_PATTERNS = [
  /Premium Admin System/i,
  /^Premium Admin$/i,
  /Global Command Menu/i,
  /Analytics Dashboard/i,
  /^Analytics$/i,
  /Click Log/i,
  /Trust Score/i,
  /Unique IPs/i,
  /IP Address/i,
  /Export Excel/i,
  /Failed to load notes/i,
  /Thiếu bot account/i,
  /Tenant bot lệch tenant hiện tại/i,
  /Runtime sẵn sàng/i,
  /Đã bind account/i,
  /Chưa bind account/i,
  /match customer/i,
  /auto reminder/i,
  /bot contacts/i,
  /contact sync/i,
  /contact store/i,
  /Anti-Fraud/i,
  /Copy Token/i,
  /Đã copy token/i,
  /Đã copy link/i,
  /Đang tải analytics/i,
  /dữ liệu analytics/i,
  /Tổng clicks/i,
  /Token ON/i,
  /Token OFF/i,
  /Telegram ON/i,
  /Telegram OFF/i,
  /người click đầu tiên/i,
  /khi có click/i,
  /mỗi khi có click/i,
  /Lịch sử click/i,
  /click nữa/i,
  /Ã|�/,
];

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
  return (
    literal.length === 0 ||
    /^[@./]/.test(literal) ||
    /^\/[A-Za-z0-9/_-]*$/.test(literal) ||
    /^[a-z0-9_./-]+$/.test(literal) ||
    /^[A-Z0-9_]+$/.test(literal)
  );
}

function extractStringLiterals(line) {
  const matches = line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g);
  return [...matches].map((match) => match[2]);
}

function collectViolations(filePath) {
  const violations = [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const literals = extractStringLiterals(line)
      .map((literal) => literal.trim())
      .filter((literal) => !shouldIgnoreLiteral(literal));

    for (const literal of literals) {
      const banned = BANNED_PATTERNS.find((pattern) => pattern.test(literal));
      if (!banned) {
        continue;
      }

      violations.push({
        file: normalizePath(filePath),
        line: index + 1,
        literal,
      });
    }
  });

  return violations;
}

const files = ROOTS.flatMap((root) => walk(root));
const violations = files.flatMap((file) => collectViolations(file));

if (violations.length > 0) {
  console.error("UI copy guard violations detected:");
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}: ${violation.literal}`);
  }
  process.exit(1);
}

console.log("No blocked English or mojibake UI copy detected.");
