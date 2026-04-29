import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { detectRuntimeBaseURL } from "../apps/admin-web/scripts/detect-base-url.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const appDir = path.join(rootDir, "apps", "admin-web");
const registerLoaderPath = path.join(appDir, "scripts", "register-ts-loader.mjs");
const liveTelegram = process.argv.includes("--live-telegram") || process.env.CHECK_ALL_LIVE_TELEGRAM === "1";
const allowRuntimeReuse = process.argv.includes("--reuse-runtime") || process.env.CHECK_ALL_REUSE_RUNTIME === "1";
const pnpmExecPath = process.env.npm_execpath ?? null;
const HEARTBEAT_INTERVAL_MS = 60_000;
const qaLogDir = path.join(rootDir, "qa-artifacts", "check-all");
const qaLogPath = path.join(qaLogDir, "check-all.log");
await fs.mkdir(qaLogDir, { recursive: true });
const qaLogStream = fsSync.createWriteStream(qaLogPath, { flags: "a" });

function emitCheckAllLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  qaLogStream.write(`${line}\n`);
}

function mirrorChildOutput(stream, target) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    target.write(chunk);
    qaLogStream.write(chunk);
  });
}

const STEP_TIMEOUTS = {
  lint: 15 * 60_000,
  typecheck: 20 * 60_000,
  test: 30 * 60_000,
  build: 45 * 60_000,
  bot: 10 * 60_000,
  runtime: 20 * 60_000,
};

function formatCommand(command, args, cwd) {
  const cwdLabel = path.relative(rootDir, cwd) || ".";
  return `${cwdLabel}> ${[command, ...args].join(" ")}`;
}

function run(command, args, cwd, options = {}) {
  const { env = process.env, timeoutMs = 0, heartbeatLabel = null } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });
    mirrorChildOutput(child.stdout, process.stdout);
    mirrorChildOutput(child.stderr, process.stderr);

    const startedAt = Date.now();
    const heartbeat = heartbeatLabel
      ? setInterval(() => {
          const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
          emitCheckAllLog(`[check-all] ${heartbeatLabel} still running (${elapsedSeconds}s elapsed)`);
        }, HEARTBEAT_INTERVAL_MS)
      : null;

    const timeout = timeoutMs
      ? setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
          clearInterval(heartbeat);
          reject(new Error(`${heartbeatLabel ?? formatCommand(command, args, cwd)} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    const finalize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    };

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      finalize();
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      finalize();

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${formatCommand(command, args, cwd)} failed${signal ? ` (signal ${signal})` : ` with code ${code ?? 1}`}`,
        ),
      );
    });
  });
}

function spawnDetached(command, args, cwd, env = process.env) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });
  mirrorChildOutput(child.stdout, process.stdout);
  mirrorChildOutput(child.stderr, process.stderr);

  child.on("error", (error) => {
    emitCheckAllLog(`[check-all] Failed to start ${formatCommand(command, args, cwd)}: ${error instanceof Error ? error.message : String(error)}`);
  });

  return child;
}

function toEntrySpecifier(scriptPath, cwd) {
  const relativeScriptPath = path.relative(cwd, scriptPath).split(path.sep).join("/");
  return relativeScriptPath.startsWith(".") ? relativeScriptPath : `./${relativeScriptPath}`;
}

async function runPnpm(args, cwd = rootDir) {
  return runPnpmWithOptions(args, cwd);
}

async function runPnpmWithOptions(args, cwd = rootDir, options = {}) {
  if (pnpmExecPath) {
    await run(process.execPath, [pnpmExecPath, ...args], cwd, options);
    return;
  }

  await run("pnpm", args, cwd, options);
}

async function runNodeScript(scriptPath, cwd, env = process.env, extraArgs = []) {
  return spawnDetached(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      pathToFileURL(registerLoaderPath).href,
      toEntrySpecifier(scriptPath, cwd),
      ...extraArgs,
    ],
    cwd,
    env,
  );
}

async function runStep(label, command, args, cwd = rootDir) {
  const startedAt = Date.now();
  emitCheckAllLog(`[check-all] ${label}`);
  emitCheckAllLog(`[check-all] ${formatCommand(command, args, cwd)}`);
  await run(command, args, cwd, { heartbeatLabel: label });
  const durationMs = Date.now() - startedAt;
  emitCheckAllLog(`[check-all] ${label} done in ${durationMs}ms`);
}

async function runManagedStep(step) {
  const startedAt = Date.now();
  emitCheckAllLog(`[check-all] ${step.label}`);
  await step.run();
  const durationMs = Date.now() - startedAt;
  emitCheckAllLog(`[check-all] ${step.label} done in ${durationMs}ms`);
}

async function waitForRuntimeBaseURL(timeoutMs = 180_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await detectRuntimeBaseURL();
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(
    `Timed out waiting for the ManagerOrder runtime. Last error: ${lastError instanceof Error ? lastError.message : String(lastError ?? "unknown")}`,
  );
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function resolveRuntimeBaseURLTarget() {
  const preferredPorts = [3000, 3001, 3002];

  for (const port of preferredPorts) {
    if (await isPortFree(port)) {
      return `http://localhost:${port}`;
    }
  }

  throw new Error(
    `Unable to start a temporary ManagerOrder runtime. All preferred ports are busy: ${preferredPorts.join(", ")}`,
  );
}

async function ensureRuntimeServer() {
  if (allowRuntimeReuse) {
    try {
      const baseURL = await detectRuntimeBaseURL();
      emitCheckAllLog(`[check-all] Reusing runtime at ${baseURL}`);
      return { baseURL, child: null };
    } catch {
      // Start a temporary runtime below.
    }
  }

  const baseURL = await resolveRuntimeBaseURLTarget();
  process.env.RUNTIME_BASE_URL = baseURL;
  process.env.BASE_URL = baseURL;

  emitCheckAllLog(`[check-all] No runtime detected. Starting a temporary admin-web start server for browser QA at ${baseURL}.`);
  const runtimeEnv = {
    ...process.env,
    PORT: new URL(baseURL).port,
    TELEGRAM_BOT_TOKEN: "",
    ZALO_BOT_TOKEN: "",
    CODEX_USE_LOCAL_FALLBACK: "1",
    CODEX_ALLOW_LOCAL_WEBHOOK_READ_FALLBACK: "1",
  };
  const child = await runNodeScript(
    path.join(appDir, "scripts", "runtime-supervisor.ts"),
    appDir,
    runtimeEnv,
    ["--mode=start"],
  );
  await waitForRuntimeBaseURL();
  emitCheckAllLog(`[check-all] Temporary runtime ready at ${baseURL}`);
  return { baseURL, child };
}

async function stopRuntime(child) {
  if (!child) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill();
  });
}

async function runTelegramLiveChecks() {
  const telegramScripts = [
    "check-telegram-commands.ts",
    "check-telegram-commands-vi.ts",
    "test-telegram-commands.ts",
    "test-bot-handler.ts",
  ];

  for (const scriptName of telegramScripts) {
    const scriptPath = path.join(appDir, "scripts", scriptName);
    await runStep(
      `telegram:${scriptName}`,
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        pathToFileURL(registerLoaderPath).href,
        toEntrySpecifier(scriptPath, appDir),
      ],
      appDir,
    );
  }
}

async function main() {
  await fs.access(path.join(rootDir, "package.json"));

  const preRuntimeSteps = [
    {
      label: "admin lint",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "lint"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.lint,
          heartbeatLabel: "admin lint",
        }),
    },
    {
      label: "bot lint",
      run: () =>
        runPnpmWithOptions(["--dir", "packages/zalo-bot-js", "run", "lint"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.lint,
          heartbeatLabel: "bot lint",
        }),
    },
    {
      label: "admin typecheck",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "typecheck"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.typecheck,
          heartbeatLabel: "admin typecheck",
        }),
    },
    {
      label: "bot typecheck",
      run: () =>
        runPnpmWithOptions(["--dir", "packages/zalo-bot-js", "run", "typecheck"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.typecheck,
          heartbeatLabel: "bot typecheck",
        }),
    },
    {
      label: "admin tests",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "test"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.test,
          heartbeatLabel: "admin tests",
        }),
    },
    {
      label: "bot tests",
      run: () =>
        runPnpmWithOptions(["--dir", "packages/zalo-bot-js", "run", "test"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.test,
          heartbeatLabel: "bot tests",
        }),
    },
    {
      label: "telegram runtime smoke",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "check:telegram-runtime"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.bot,
          heartbeatLabel: "telegram runtime smoke",
        }),
    },
    {
      label: "zalo runtime smoke",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "check:zalo-runtime"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.bot,
          heartbeatLabel: "zalo runtime smoke",
        }),
    },
    {
      label: "admin build",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "build"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.build,
          heartbeatLabel: "admin build",
        }),
    },
    {
      label: "bot build",
      run: () =>
        runPnpmWithOptions(["--dir", "packages/zalo-bot-js", "run", "build"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.build,
          heartbeatLabel: "bot build",
        }),
    },
  ];

  const runtimeSteps = [
    {
      label: "admin runtime ops QA",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "qa:ops-runtime"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.runtime,
          heartbeatLabel: "admin runtime ops QA",
        }),
    },
    {
      label: "admin runtime smoke",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "smoke:runtime"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.runtime,
          heartbeatLabel: "admin runtime smoke",
        }),
    },
    {
      label: "admin visual QA",
      run: () =>
        runPnpmWithOptions(["--dir", "apps/admin-web", "run", "qa:visual"], rootDir, {
          timeoutMs: STEP_TIMEOUTS.runtime,
          heartbeatLabel: "admin visual QA",
        }),
    },
  ];

  for (const step of preRuntimeSteps) {
    await runManagedStep(step);
  }

  const runtime = await ensureRuntimeServer();

  try {
    for (const step of runtimeSteps) {
      await runManagedStep(step);
    }
  } finally {
    await stopRuntime(runtime?.child);
  }

  if (liveTelegram) {
    emitCheckAllLog("[check-all] live Telegram mode enabled. This will touch the live bot configuration.");
    await runTelegramLiveChecks();
  }

  emitCheckAllLog("[check-all] All project checks completed successfully.");
}
try {
  await main();
} finally {
  await new Promise((resolve) => qaLogStream.end(resolve));
}
