import {
  assertShortLinkDeliverySchema,
} from "./short-link-runtime-utils.mjs";

const result = await assertShortLinkDeliverySchema();

if (!result.ok) {
  if (result.connectionFailure) {
    console.error("Short-link delivery schema could not be verified because Supabase is unreachable.");
    console.error(`Connection error: ${result.connectionFailure}`);
  } else {
    console.error("Short-link delivery schema is not ready.");
  }

  console.error(`Required migration: ${result.migrationFile}`);
  for (const failure of result.failures) {
    console.error(`- ${failure.table} (${failure.migration}): ${failure.message}`);
  }
  process.exit(1);
}

console.log("Short-link delivery schema is ready.");
console.log(`Verified migration footprint: ${result.migrationFile}`);
