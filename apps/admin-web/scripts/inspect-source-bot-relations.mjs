import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function loadEnvValue(lines, key) {
  const prefix = `${key}=`;
  const line = lines.find((entry) => entry.startsWith(prefix));
  if (!line) {
    throw new Error(`Missing ${key} in .env.local`);
  }
  return line.slice(prefix.length).trim().replace(/^"(.*)"$/, '$1');
}

async function main() {
  const envPath = resolve(process.cwd(), '.env.local');
  const lines = (await readFile(envPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const url = loadEnvValue(lines, 'NEXT_PUBLIC_SUPABASE_URL');
  const key = loadEnvValue(lines, 'SUPABASE_SERVICE_ROLE_KEY');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const tests = [
    {
      name: 'source_accounts->accounts',
      path: '/rest/v1/source_accounts?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'source_accounts->integrations',
      path: '/rest/v1/source_accounts?select=id,account_id,integrations(id)&limit=1',
    },
    {
      name: 'reminder_config->accounts',
      path: '/rest/v1/reminder_config?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'reminder_events->accounts',
      path: '/rest/v1/reminder_events?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'reminder_events->customers',
      path: '/rest/v1/reminder_events?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'reminder_logs->accounts',
      path: '/rest/v1/reminder_logs?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'reminder_logs->orders',
      path: '/rest/v1/reminder_logs?select=id,order_id,orders(id)&limit=1',
    },
    {
      name: 'reminder_logs->customers',
      path: '/rest/v1/reminder_logs?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'system_settings->accounts',
      path: '/rest/v1/system_settings?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'activity_logs->accounts',
      path: '/rest/v1/activity_logs?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'activity_logs->customers',
      path: '/rest/v1/activity_logs?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'activity_logs->orders',
      path: '/rest/v1/activity_logs?select=id,order_id,orders(id)&limit=1',
    },
    {
      name: 'activity_logs->source_accounts',
      path: '/rest/v1/activity_logs?select=id,source_account_id,source_accounts(id)&limit=1',
    },
    {
      name: 'bot_user_contacts->accounts',
      path: '/rest/v1/bot_user_contacts?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'bot_user_contacts->customers',
      path: '/rest/v1/bot_user_contacts?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'bot_sessions->accounts',
      path: '/rest/v1/bot_sessions?select=id,account_id,accounts(id)&limit=1',
    },
    {
      name: 'bot_sessions->customers',
      path: '/rest/v1/bot_sessions?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'bot_error_logs->sessions',
      path: '/rest/v1/bot_error_logs?select=id,session_id,bot_sessions(id)&limit=1',
    },
    {
      name: 'bot_error_logs->customers',
      path: '/rest/v1/bot_error_logs?select=id,customer_id,customers(id)&limit=1',
    },
    {
      name: 'bot_sessions->raw',
      path: '/rest/v1/bot_sessions?select=*&limit=1',
    },
    {
      name: 'bot_error_logs->raw',
      path: '/rest/v1/bot_error_logs?select=*&limit=1',
    },
  ];

  for (const test of tests) {
    const response = await fetch(`${url}${test.path}`, { headers });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    const message =
      typeof payload === 'string'
        ? payload.slice(0, 240)
        : JSON.stringify(payload).slice(0, 240);
    const keys =
      Array.isArray(payload) && payload[0] && typeof payload[0] === 'object'
        ? Object.keys(payload[0])
        : null;

    console.log(
      JSON.stringify(
        {
          test: test.name,
          status: response.status,
          body: message,
          keys,
        },
        null,
        2,
      ),
      );
  }

  const openApiResponse = await fetch(`${url}/rest/v1/`, {
    headers: {
      ...headers,
      Accept: 'application/openapi+json',
    },
  });
  const openApiText = await openApiResponse.text();
  try {
    const spec = JSON.parse(openApiText);
    const pathKeys = Object.keys(spec.paths ?? {}).filter((key) =>
      /bot|reminder|activity|source_accounts|system_settings/i.test(key),
    );
    const tableSchemas = {};
    for (const tablePath of [
      '/bot_sessions',
      '/bot_error_logs',
      '/bot_user_contacts',
      '/reminder_logs',
      '/reminder_config',
      '/reminder_events',
      '/activity_logs',
      '/source_accounts',
      '/system_settings',
    ]) {
      const properties =
        spec.paths?.[tablePath]?.get?.responses?.['200']?.content?.['application/json']?.schema?.items
          ?.properties ?? {};
      tableSchemas[tablePath] = Object.keys(properties);
    }
    console.log(
      JSON.stringify(
        {
          test: 'openapi-root',
          status: openApiResponse.status,
          contentType: openApiResponse.headers.get('content-type'),
          pathKeys,
          tableSchemas,
        },
        null,
        2,
      ),
    );
  } catch {
    console.log(
      JSON.stringify(
        {
          test: 'openapi-root',
          status: openApiResponse.status,
          contentType: openApiResponse.headers.get('content-type'),
          body: openApiText.slice(0, 240),
        },
        null,
        2,
      ),
    );
  }

  const probeId = `codex-probe-${Date.now()}`;
  const insertResponse = await fetch(`${url}/rest/v1/bot_error_logs`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      account_id: '550e8400-e29b-41d4-a716-446655440000',
      customer_id: null,
      zalo_user_id: probeId,
      error_type: 'other',
      description: 'schema probe',
    }),
  });
  const insertText = await insertResponse.text();
  let insertPayload;
  try {
    insertPayload = JSON.parse(insertText);
  } catch {
    insertPayload = insertText;
  }
  console.log(
    JSON.stringify(
      {
        test: 'bot_error_logs->insert-probe',
        status: insertResponse.status,
        body:
          typeof insertPayload === 'string'
            ? insertPayload.slice(0, 240)
            : JSON.stringify(insertPayload).slice(0, 240),
        keys:
          Array.isArray(insertPayload) && insertPayload[0] && typeof insertPayload[0] === 'object'
            ? Object.keys(insertPayload[0])
            : null,
      },
      null,
      2,
    ),
  );

  if (insertResponse.ok && Array.isArray(insertPayload) && insertPayload[0]?.id) {
    await fetch(`${url}/rest/v1/bot_error_logs?id=eq.${insertPayload[0].id}`, {
      method: 'DELETE',
      headers,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
