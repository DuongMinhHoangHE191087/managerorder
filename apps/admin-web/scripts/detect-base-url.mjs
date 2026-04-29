const DEFAULT_HEALTH_PATH = "/api/health";

function getDefaultCandidates() {
  return [
    process.env.RUNTIME_BASE_URL,
    process.env.BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ].filter(Boolean);
}

function normalizeCandidate(candidate) {
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

async function readHealthPayload(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function detectRuntimeBaseURL({
  candidates = getDefaultCandidates(),
  healthPath = DEFAULT_HEALTH_PATH,
  timeoutMs = 5_000,
} = {}) {
  const uniqueCandidates = [...new Set(candidates)]
    .map((candidate) => String(candidate).trim())
    .filter(Boolean);
  const failures = [];

  for (const candidate of uniqueCandidates) {
    const origin = normalizeCandidate(candidate);
    if (!origin) {
      failures.push(`${candidate} -> invalid URL`);
      continue;
    }

    const healthUrl = new URL(healthPath, origin).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        failures.push(`${origin} -> HTTP ${response.status}`);
        continue;
      }

      const payload = await readHealthPayload(response);
      if (!payload || payload.status !== "ok") {
        failures.push(`${origin} -> invalid health payload`);
        continue;
      }

      if (payload.service !== "managerorder-admin-web") {
        failures.push(`${origin} -> unexpected service ${String(payload.service)}`);
        continue;
      }

      return origin;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${origin} -> ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `Unable to detect ManagerOrder runtime base URL. Checked ${healthPath} on: ${uniqueCandidates.join(", ")}. Failures: ${failures.join(" | ")}`,
  );
}
