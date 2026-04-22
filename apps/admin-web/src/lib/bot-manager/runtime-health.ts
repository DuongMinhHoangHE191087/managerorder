import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getCache, setCache } from "@/lib/redis/client";
import { resolveTelegramRuntimeMode, resolveZaloRuntimeMode } from "./runtime-mode";

export type BotRuntimeChannel = "telegram" | "zalo";
export type BotRuntimeTransport = "webhook" | "polling";

export interface BotRuntimeSnapshot {
  channel: BotRuntimeChannel;
  transport: BotRuntimeTransport;
  configuredMode: string;
  pid: number;
  startedAt: string;
  lastHeartbeatAt: string;
  lastInboundAt: string | null;
  lastReplyAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const POLLING_HEALTH_WINDOW_MS = 95_000;

function runtimeCacheKey(channel: BotRuntimeChannel): string {
  return `bot-runtime:${channel}`;
}

function runtimeFilePath(channel: BotRuntimeChannel): string {
  return path.join(os.tmpdir(), `managerorder-bot-runtime-${channel}.json`);
}

function defaultConfiguredMode(channel: BotRuntimeChannel): string {
  return channel === "telegram"
    ? resolveTelegramRuntimeMode(process.env)
    : resolveZaloRuntimeMode(process.env);
}

function defaultTransport(
  channel: BotRuntimeChannel,
  configuredMode: string,
): BotRuntimeTransport {
  if (channel === "telegram") {
    return configuredMode === "webhook" ? "webhook" : "polling";
  }

  return "polling";
}

function safeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

async function writeRuntimeFile(
  channel: BotRuntimeChannel,
  snapshot: BotRuntimeSnapshot,
): Promise<void> {
  await fs.writeFile(
    runtimeFilePath(channel),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  ).catch(() => undefined);
}

async function readRuntimeFile(
  channel: BotRuntimeChannel,
): Promise<BotRuntimeSnapshot | null> {
  try {
    const raw = await fs.readFile(runtimeFilePath(channel), "utf8");
    return JSON.parse(raw) as BotRuntimeSnapshot;
  } catch {
    return null;
  }
}

export async function getBotRuntimeSnapshot(
  channel: BotRuntimeChannel,
): Promise<BotRuntimeSnapshot | null> {
  const fromFile = await readRuntimeFile(channel);
  if (fromFile) {
    await setCache(runtimeCacheKey(channel), fromFile, CACHE_TTL_SECONDS);
    return fromFile;
  }

  const cached = await getCache<BotRuntimeSnapshot>(runtimeCacheKey(channel));
  if (cached) {
    await writeRuntimeFile(channel, cached);
  }
  return cached;
}

export async function updateBotRuntimeSnapshot(
  channel: BotRuntimeChannel,
  patch: Partial<BotRuntimeSnapshot>,
): Promise<BotRuntimeSnapshot> {
  const now = new Date().toISOString();
  const current = await getBotRuntimeSnapshot(channel);
  const configuredMode =
    patch.configuredMode ?? current?.configuredMode ?? defaultConfiguredMode(channel);
  const snapshot: BotRuntimeSnapshot = {
    channel,
    transport:
      patch.transport ??
      current?.transport ??
      defaultTransport(channel, configuredMode),
    configuredMode,
    pid: patch.pid ?? current?.pid ?? process.pid,
    startedAt: patch.startedAt ?? current?.startedAt ?? now,
    lastHeartbeatAt: patch.lastHeartbeatAt ?? current?.lastHeartbeatAt ?? now,
    lastInboundAt: patch.lastInboundAt ?? current?.lastInboundAt ?? null,
    lastReplyAt: patch.lastReplyAt ?? current?.lastReplyAt ?? null,
    lastErrorAt:
      patch.lastErrorAt !== undefined
        ? patch.lastErrorAt
        : current?.lastErrorAt ?? null,
    lastErrorMessage:
      patch.lastErrorMessage !== undefined
        ? patch.lastErrorMessage
        : current?.lastErrorMessage ?? null,
    metadata: {
      ...(current?.metadata ?? {}),
      ...(safeMetadata(patch.metadata) ?? {}),
    },
  };

  await Promise.all([
    setCache(runtimeCacheKey(channel), snapshot, CACHE_TTL_SECONDS),
    writeRuntimeFile(channel, snapshot),
  ]);

  return snapshot;
}

export function isPollingRuntimeHealthy(
  snapshot: Pick<BotRuntimeSnapshot, "lastHeartbeatAt"> | null | undefined,
  maxAgeMs = POLLING_HEALTH_WINDOW_MS,
): boolean {
  if (!snapshot?.lastHeartbeatAt) {
    return false;
  }

  const lastBeat = new Date(snapshot.lastHeartbeatAt).getTime();
  if (!Number.isFinite(lastBeat)) {
    return false;
  }

  return Date.now() - lastBeat <= maxAgeMs;
}

export async function markBotRuntimeStarted(input: {
  channel: BotRuntimeChannel;
  transport: BotRuntimeTransport;
  configuredMode: string;
  metadata?: Record<string, unknown>;
}): Promise<BotRuntimeSnapshot> {
  const now = new Date().toISOString();
  return updateBotRuntimeSnapshot(input.channel, {
    transport: input.transport,
    configuredMode: input.configuredMode,
    pid: process.pid,
    startedAt: now,
    lastHeartbeatAt: now,
    lastErrorAt: null,
    lastErrorMessage: null,
    metadata: input.metadata,
  });
}

export async function markBotRuntimeHeartbeat(
  channel: BotRuntimeChannel,
  input?: {
    transport?: BotRuntimeTransport;
    configuredMode?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<BotRuntimeSnapshot> {
  return updateBotRuntimeSnapshot(channel, {
    transport: input?.transport,
    configuredMode: input?.configuredMode,
    pid: process.pid,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: input?.metadata,
  });
}

export async function markBotRuntimeInbound(
  channel: BotRuntimeChannel,
  metadata?: Record<string, unknown>,
): Promise<BotRuntimeSnapshot> {
  const now = new Date().toISOString();
  return updateBotRuntimeSnapshot(channel, {
    pid: process.pid,
    lastHeartbeatAt: now,
    lastInboundAt: now,
    metadata,
  });
}

export async function markBotRuntimeReply(
  channel: BotRuntimeChannel,
  metadata?: Record<string, unknown>,
): Promise<BotRuntimeSnapshot> {
  const now = new Date().toISOString();
  return updateBotRuntimeSnapshot(channel, {
    pid: process.pid,
    lastHeartbeatAt: now,
    lastReplyAt: now,
    metadata,
  });
}

export async function markBotRuntimeError(
  channel: BotRuntimeChannel,
  error: unknown,
  metadata?: Record<string, unknown>,
): Promise<BotRuntimeSnapshot> {
  const message = error instanceof Error ? error.message : String(error);
  return updateBotRuntimeSnapshot(channel, {
    pid: process.pid,
    lastHeartbeatAt: new Date().toISOString(),
    lastErrorAt: new Date().toISOString(),
    lastErrorMessage: message,
    metadata,
  });
}
