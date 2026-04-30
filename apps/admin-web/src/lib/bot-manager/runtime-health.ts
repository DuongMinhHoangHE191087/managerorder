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
const REDACTED_VALUE = "[redacted]";
const SENSITIVE_KEY_PATTERN = /(?:token|secret|password|authorization|api[_-]?key|webhook|baseurl)/i;
const BOT_API_URL_PATTERN = /(https?:\/\/[^/\s?#]+\/bot)([^/\s?#]+)/gi;

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

function sanitizeSensitiveText(value: string): string {
  return value.replace(BOT_API_URL_PATTERN, "$1[redacted]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeRuntimeValue(key: string | undefined, value: unknown): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === "string") {
    return sanitizeSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeRuntimeValue(undefined, entry))
      .filter((entry) => entry !== undefined);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([childKey, childValue]) => [childKey, sanitizeRuntimeValue(childKey, childValue)] as const)
        .filter(([, childValue]) => childValue !== undefined),
    );
  }

  return value;
}

export function sanitizeBotRuntimeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const sanitized = sanitizeRuntimeValue(undefined, metadata);
  return isRecord(sanitized) ? sanitized : null;
}

function mergeBotRuntimeMetadata(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!current && !patch) {
    return null;
  }

  return {
    ...(current ?? {}),
    ...(patch ?? {}),
  };
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
  const currentMetadata = sanitizeBotRuntimeMetadata(current?.metadata);
  const patchMetadata = sanitizeBotRuntimeMetadata(patch.metadata);
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
          ? sanitizeSensitiveText(patch.lastErrorMessage)
          : null
        : current?.lastErrorMessage !== undefined && current?.lastErrorMessage !== null
          ? sanitizeSensitiveText(current.lastErrorMessage)
          : null,
    metadata: mergeBotRuntimeMetadata(currentMetadata, patchMetadata),
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
    lastErrorMessage: sanitizeSensitiveText(message),
    metadata,
  });
}
