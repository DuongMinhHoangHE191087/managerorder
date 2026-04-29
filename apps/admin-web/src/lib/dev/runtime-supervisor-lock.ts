import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RuntimeSupervisorLock {
  pid: number;
  cwd: string;
  mode: string;
  startedAt: string;
}

export interface AcquireRuntimeSupervisorLockInput {
  lockPath: string;
  cwd: string;
  mode: string;
  pid?: number;
  isProcessAlive?: (pid: number) => boolean;
}

export interface AcquireRuntimeSupervisorLockResult {
  acquired: boolean;
  lock: RuntimeSupervisorLock;
  activeLock?: RuntimeSupervisorLock;
}

function normalizePath(value: string): string {
  return path.resolve(value);
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLock(lockPath: string): Promise<RuntimeSupervisorLock | null> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeSupervisorLock>;
    if (
      typeof parsed.pid !== "number" ||
      typeof parsed.cwd !== "string" ||
      typeof parsed.mode !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }

    return {
      pid: parsed.pid,
      cwd: normalizePath(parsed.cwd),
      mode: parsed.mode,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

async function writeLock(lockPath: string, lock: RuntimeSupervisorLock): Promise<void> {
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

export async function acquireRuntimeSupervisorLock(
  input: AcquireRuntimeSupervisorLockInput,
): Promise<AcquireRuntimeSupervisorLockResult> {
  const cwd = normalizePath(input.cwd);
  const pid = input.pid ?? process.pid;
  const isProcessAlive = input.isProcessAlive ?? defaultIsProcessAlive;
  const currentLock = await readLock(input.lockPath);

  if (
    currentLock &&
    currentLock.pid !== pid &&
    currentLock.cwd === cwd &&
    isProcessAlive(currentLock.pid)
  ) {
    return {
      acquired: false,
      lock: {
        pid,
        cwd,
        mode: input.mode,
        startedAt: new Date().toISOString(),
      },
      activeLock: currentLock,
    };
  }

  const lock: RuntimeSupervisorLock = {
    pid,
    cwd,
    mode: input.mode,
    startedAt: new Date().toISOString(),
  };

  await writeLock(input.lockPath, lock);

  return { acquired: true, lock };
}

export async function releaseRuntimeSupervisorLock(lockPath: string): Promise<void> {
  await rm(lockPath, { force: true });
}
