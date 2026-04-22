import { spawn } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { loadLocalEnv } from "./load-local-env";
import { resolveTelegramRuntimeMode } from "../src/lib/bot-manager/runtime-mode";
import { canStartZaloBot, describeZaloRuntime, resolveZaloRuntimeConfig } from "../src/lib/zalo/config";

type ManagedChild = {
  name: string;
  command: string;
  args: string[];
  restartable: boolean;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  child?: ReturnType<typeof spawn>;
  stopped: boolean;
  restartDelayMs: number;
};

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

loadLocalEnv();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const registerLoaderPath = path.resolve(currentDir, "register-ts-loader.mjs");
const registerLoaderUrl = pathToFileURL(registerLoaderPath).href;
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = (modeArg?.split("=")[1] || process.argv[2] || "dev").trim();

const logger = console;

function makeNodeArgs(scriptPath: string): string[] {
  const relativeScriptPath = path.relative(projectRoot, scriptPath).split(path.sep).join("/");
  const entrySpecifier = relativeScriptPath.startsWith(".") ? relativeScriptPath : `./${relativeScriptPath}`;

  return [
    "--experimental-strip-types",
    "--import",
    registerLoaderUrl,
    entrySpecifier,
  ];
}

function spawnManagedChild(child: ManagedChild, env: NodeJS.ProcessEnv = process.env): void {
  const launch = () => {
    if (child.stopped) return;

    const proc = spawn(child.command, child.args, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      windowsHide: true,
    });

    child.child = proc;

    proc.on("exit", (code, signal) => {
      child.child = undefined;
      if (child.stopped) return;

      const exitCode = code ?? (signal ? 1 : 0);
      if (exitCode === 0) {
        logger.log(`[Supervisor] ${child.name} exited cleanly.`);
        child.onExit?.(code, signal);
        return;
      }

      logger.error(`[Supervisor] ${child.name} exited with code ${exitCode}${signal ? ` (signal ${signal})` : ""}.`);
      child.onExit?.(code, signal);

      if (!child.restartable) {
        return;
      }

      const delay = child.restartDelayMs;
      child.restartDelayMs = Math.min(child.restartDelayMs * 2, 30_000);
      logger.warn(`[Supervisor] Restarting ${child.name} in ${delay}ms...`);
      setTimeout(() => launch(), delay);
    });

    proc.on("error", (error) => {
      logger.error(`[Supervisor] Failed to start ${child.name}:`, error);
      if (!child.restartable || child.stopped) {
        if (!child.restartable) {
          process.exit(1);
        }
        return;
      }
      const delay = child.restartDelayMs;
      child.restartDelayMs = Math.min(child.restartDelayMs * 2, 30_000);
      setTimeout(() => launch(), delay);
    });
  };

  launch();
}

function stopChild(child: ManagedChild): void {
  child.stopped = true;
  child.child?.kill("SIGTERM");
}

function resolveTelegramScript(): string {
  return path.resolve(projectRoot, "scripts", "telegram-bot-poll.ts");
}

function resolveZaloScript(): string {
  return path.resolve(projectRoot, "scripts", "zalo-bot-poll.ts");
}

function resolveWebArgs(): string[] {
  if (mode === "docker") {
    const standaloneServer = path.resolve(projectRoot, ".next", "standalone", "server.js");
    const rootServer = path.resolve(projectRoot, "server.js");
    return [existsSync(rootServer) ? rootServer : standaloneServer];
  }

  if (mode === "start") {
    return [nextBin, "start"];
  }

  return [nextBin, "dev", "--turbopack"];
}

async function main(): Promise<void> {
  const webArgs = resolveWebArgs();
  const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const zaloConfig = resolveZaloRuntimeConfig(process.env);
  const telegramRuntimeMode = resolveTelegramRuntimeMode(process.env);

  logger.log(`[Supervisor] Starting runtime in ${mode} mode.`);
  logger.log(`[Supervisor] Telegram runtime mode: ${telegramRuntimeMode}.`);
  for (const warning of zaloConfig.warnings) {
    logger.warn(`[Supervisor] Zalo config: ${warning}`);
  }
  if (canStartZaloBot(zaloConfig)) {
    logger.log(`[Supervisor] Zalo runtime: ${describeZaloRuntime(zaloConfig)}`);
  }

  const webChild: ManagedChild = {
    name: "web",
    command: process.execPath,
    args: webArgs,
    restartable: false,
    stopped: false,
    restartDelayMs: 0,
    onExit(code) {
      logger.error(`[Supervisor] Web process exited (${code ?? 0}). Shutting down bots.`);
      stopChild(telegramChild);
      stopChild(zaloChild);
      process.exit(code ?? 0);
    },
  };

  const telegramChild: ManagedChild = {
    name: "telegram",
    command: process.execPath,
    args: makeNodeArgs(resolveTelegramScript()),
    restartable: true,
    stopped: false,
    restartDelayMs: 2_000,
  };

  const zaloChild: ManagedChild = {
    name: "zalo",
    command: process.execPath,
    args: makeNodeArgs(resolveZaloScript()),
    restartable: true,
    stopped: false,
    restartDelayMs: 2_000,
  };

  process.once("SIGINT", () => {
    logger.log("[Supervisor] SIGINT received. Stopping children...");
    stopChild(webChild);
    stopChild(telegramChild);
    stopChild(zaloChild);
    setTimeout(() => process.exit(0), 500);
  });

  process.once("SIGTERM", () => {
    logger.log("[Supervisor] SIGTERM received. Stopping children...");
    stopChild(webChild);
    stopChild(telegramChild);
    stopChild(zaloChild);
    setTimeout(() => process.exit(0), 500);
  });

  spawnManagedChild(webChild);

  if (telegramToken && telegramRuntimeMode === "polling") {
    spawnManagedChild(telegramChild);
  } else if (telegramToken) {
    logger.log("[Supervisor] Telegram polling disabled; web runtime will serve webhook mode.");
  } else {
    logger.warn("[Supervisor] Skipping Telegram bot: TELEGRAM_BOT_TOKEN is missing.");
  }

  if (canStartZaloBot(zaloConfig)) {
    spawnManagedChild(zaloChild);
  } else {
    logger.warn("[Supervisor] Skipping Zalo bot: ZALO_BOT_TOKEN is missing.");
  }
}

void main().catch((error) => {
  logger.error("[Supervisor] Fatal startup error:", error);
  process.exit(1);
});
