import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  acquireRuntimeSupervisorLock,
  releaseRuntimeSupervisorLock,
} from "../runtime-supervisor-lock";

describe("runtime-supervisor-lock", () => {
  it("writes a new lock when none exists", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "managerorder-supervisor-lock-"));
    const lockPath = path.join(dir, "runtime-supervisor.lock.json");

    const result = await acquireRuntimeSupervisorLock({
      lockPath,
      cwd: "D:/GITHUB/managerorder",
      mode: "dev",
      pid: 1234,
      isProcessAlive: () => false,
    });

    expect(result.acquired).toBe(true);

    const raw = await readFile(lockPath, "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      pid: 1234,
      cwd: path.resolve("D:/GITHUB/managerorder"),
      mode: "dev",
    });
  });

  it("reuses an active lock for the same project and mode", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "managerorder-supervisor-lock-"));
    const lockPath = path.join(dir, "runtime-supervisor.lock.json");
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 5678,
        cwd: path.resolve("D:/GITHUB/managerorder"),
        mode: "dev",
        startedAt: "2026-04-23T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await acquireRuntimeSupervisorLock({
      lockPath,
      cwd: "D:/GITHUB/managerorder",
      mode: "dev",
      pid: 1234,
      isProcessAlive: (pid) => pid === 5678,
    });

    expect(result.acquired).toBe(false);
    expect(result.activeLock).toMatchObject({
      pid: 5678,
      mode: "dev",
    });
  });

  it("blocks a live lock even when the mode differs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "managerorder-supervisor-lock-"));
    const lockPath = path.join(dir, "runtime-supervisor.lock.json");
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 5678,
        cwd: path.resolve("D:/GITHUB/managerorder"),
        mode: "start",
        startedAt: "2026-04-23T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await acquireRuntimeSupervisorLock({
      lockPath,
      cwd: "D:/GITHUB/managerorder",
      mode: "dev",
      pid: 1234,
      isProcessAlive: (pid) => pid === 5678,
    });

    expect(result.acquired).toBe(false);
    expect(result.activeLock).toMatchObject({
      pid: 5678,
      mode: "start",
    });
  });

  it("overwrites a stale lock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "managerorder-supervisor-lock-"));
    const lockPath = path.join(dir, "runtime-supervisor.lock.json");
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 5678,
        cwd: path.resolve("D:/GITHUB/managerorder"),
        mode: "dev",
        startedAt: "2026-04-23T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await acquireRuntimeSupervisorLock({
      lockPath,
      cwd: "D:/GITHUB/managerorder",
      mode: "dev",
      pid: 1234,
      isProcessAlive: () => false,
    });

    expect(result.acquired).toBe(true);

    const raw = await readFile(lockPath, "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      pid: 1234,
      cwd: path.resolve("D:/GITHUB/managerorder"),
      mode: "dev",
    });
  });

  it("removes the lock on release", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "managerorder-supervisor-lock-"));
    const lockPath = path.join(dir, "runtime-supervisor.lock.json");
    await writeFile(lockPath, "{}", "utf8");

    await releaseRuntimeSupervisorLock(lockPath);

    await expect(readFile(lockPath, "utf8")).rejects.toThrow();
  });
});
