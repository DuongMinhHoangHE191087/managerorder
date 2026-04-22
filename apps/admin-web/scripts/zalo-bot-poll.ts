import { loadLocalEnv } from "./load-local-env";
import {
  canStartZaloBot,
  createZaloRuntime,
  describeZaloRuntime,
  resolveZaloRuntimeConfig,
} from "../src/integrations/zalo";

loadLocalEnv();

async function main(): Promise<void> {
  const config = resolveZaloRuntimeConfig(process.env);
  for (const warning of config.warnings) {
    console.warn(`[Zalo] ${warning}`);
  }
  if (!canStartZaloBot(config)) {
    console.warn("[Zalo] Missing ZALO_BOT_TOKEN; skipping bot startup.");
    process.exit(0);
  }
  console.log(`[Zalo] Runtime config: ${describeZaloRuntime(config)}`);

  const runtime = await createZaloRuntime(config);

  const stop = async (signal: string): Promise<void> => {
    console.log(`[Zalo] ${signal} received. Shutting down...`);
    await runtime.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void stop("SIGINT"));
  process.once("SIGTERM", () => void stop("SIGTERM"));

  try {
    await runtime.start();
  } catch (error) {
    console.error("[Zalo] Fatal startup error:", error);
    process.exit(1);
  }
}

void main();
