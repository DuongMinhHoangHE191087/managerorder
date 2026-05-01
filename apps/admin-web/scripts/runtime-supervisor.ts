import { spawn } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { loadLocalEnv } from "./load-local-env";
import {
  acquireRuntimeSupervisorLock,
  releaseRuntimeSupervisorLock,
} from "../src/lib/dev/runtime-supervisor-lock";
import { resolveTelegramRuntimeMode } from "../src/lib/bot-manager/runtime-mode";

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
let nextBin: string;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch (e) {
  // Ignore error here, it will be handled in resolveWebArgs if needed
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
loadLocalEnv(path.resolve(projectRoot, ".env.local"));
const supervisorLockPath = path.resolve(projectRoot, ".next", "dev", "runtime-supervisor.lock.json");
const registerLoaderPath = path.resolve(currentDir, "register-ts-loader.mjs");
const registerLoaderUrl = pathToFileURL(registerLoaderPath).href;
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = (modeArg?.split("=")[1] || process.argv[2] || "dev").trim();

const logger = console;
let shutdownRequested = false;

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

function resolveWebArgs(): string[] {
  if (mode === "docker") {
    const standaloneServer = path.resolve(projectRoot, ".next", "standalone", "server.js");
    const rootServer = path.resolve(projectRoot, "server.js");
    const monorepoRootServer = path.resolve(projectRoot, "..", "..", "server.js");
    
    if (existsSync(rootServer)) return [rootServer];
    if (existsSync(monorepoRootServer)) return [monorepoRootServer];
    return [standaloneServer];
  }

  if (!nextBin) {
    throw new Error("Next.js binary not found. Ensure you are in 'docker' mode or have next installed.");
  }

  if (mode === "start") {
    return [nextBin, "start"];
  }

  return [nextBin, "dev", "--turbopack"];
}

async function shutdown(
  webChild: ManagedChild,
  telegramChild: ManagedChild,
  code = 0,
): Promise<void> {
  if (shutdownRequested) {
    return;
  }
  shutdownRequested = true;
  stopChild(webChild);
  stopChild(telegramChild);
  await releaseRuntimeSupervisorLock(supervisorLockPath).catch(() => undefined);
  process.exit(code);
}

async function main(): Promise<void> {
  const webArgs = resolveWebArgs();
  const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const telegramRuntimeMode = resolveTelegramRuntimeMode(process.env);

  logger.log(`[Supervisor] Starting runtime in ${mode} mode.`);
  logger.log(`[Supervisor] Telegram runtime mode: ${telegramRuntimeMode}.`);
  logger.log("[Supervisor] Zalo runtime is not started here. Use pnpm zalo:poll for standalone testing.");

  const supervisorLock = await acquireRuntimeSupervisorLock({
    lockPath: supervisorLockPath,
    cwd: projectRoot,
    mode,
  });

  if (!supervisorLock.acquired) {
    const activeLock = supervisorLock.activeLock;
    logger.warn(
      `[Supervisor] Another ${activeLock?.mode ?? mode} supervisor is already running for ${activeLock?.cwd ?? projectRoot} ` +
        `(pid ${activeLock?.pid ?? "unknown"}, started ${activeLock?.startedAt ?? "unknown"}). ` +
        "Reusing that instance instead of starting a duplicate.",
    );
    process.exit(0);
  }

  const webChild: ManagedChild = {
    name: "web",
    command: process.execPath,
    args: webArgs,
    restartable: false,
    stopped: false,
    restartDelayMs: 0,
    onExit(code) {
      logger.error(`[Supervisor] Web process exited (${code ?? 0}). Shutting down Telegram.`);
      void shutdown(webChild, telegramChild, code ?? 0);
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

  process.once("SIGINT", () => {
    logger.log("[Supervisor] SIGINT received. Stopping children...");
    void shutdown(webChild, telegramChild, 0);
  });

  process.once("SIGTERM", () => {
    logger.log("[Supervisor] SIGTERM received. Stopping children...");
    void shutdown(webChild, telegramChild, 0);
  });

  spawnManagedChild(webChild);

  if (telegramToken && telegramRuntimeMode === "polling") {
    spawnManagedChild(telegramChild);
  } else if (telegramToken) {
    logger.log("[Supervisor] Telegram polling disabled; web runtime will serve webhook mode.");
  } else {
    logger.warn("[Supervisor] Skipping Telegram bot: TELEGRAM_BOT_TOKEN is missing.");
  }
}

void main().catch((error) => {
  logger.error("[Supervisor] Fatal startup error:", error);
  void releaseRuntimeSupervisorLock(supervisorLockPath).catch(() => undefined);
  process.exit(1);
});
