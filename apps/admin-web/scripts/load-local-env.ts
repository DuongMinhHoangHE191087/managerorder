import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "dotenv";

export function loadLocalEnv(filePath = resolve(process.cwd(), ".env.local")): boolean {
  if (!existsSync(filePath)) return false;

  const parsed = parse(readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  return true;
}
