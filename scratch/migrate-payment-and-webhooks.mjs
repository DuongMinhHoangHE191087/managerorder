import dotenv from "dotenv";
dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

async function run() {
  const query = `
    -- 1. Thêm cột bank_name và account_number vào payment_sources
    ALTER TABLE public.payment_sources ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE public.payment_sources ADD COLUMN IF NOT EXISTS account_number TEXT;

    -- 2. Tạo bảng webhook_logs
    CREATE TABLE IF NOT EXISTS public.webhook_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_transaction_id TEXT,
      payload JSONB NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
      amount NUMERIC,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Tạo index
    CREATE INDEX IF NOT EXISTS webhook_logs_account_id_idx ON public.webhook_logs(account_id);
    CREATE INDEX IF NOT EXISTS webhook_logs_external_transaction_id_idx ON public.webhook_logs(external_transaction_id);
    CREATE UNIQUE INDEX IF NOT EXISTS webhook_logs_provider_tx_idx ON public.webhook_logs(provider, external_transaction_id) WHERE external_transaction_id IS NOT NULL;

    -- Bật RLS
    ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

    -- Tạo policy
    DROP POLICY IF EXISTS tenant_isolation ON public.webhook_logs;
    CREATE POLICY tenant_isolation ON public.webhook_logs
      FOR ALL
      TO authenticated
      USING (account_id = get_user_account_id())
      WITH CHECK (account_id = get_user_account_id());
  `;

  console.log("Applying database migrations for payment sources and webhook logs...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      read_only: false
    })
  });

  if (!res.ok) {
    console.error("Error status:", res.status);
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const data = await res.json();
  console.log("Success! Result:", data);
}

run().catch(console.error);
