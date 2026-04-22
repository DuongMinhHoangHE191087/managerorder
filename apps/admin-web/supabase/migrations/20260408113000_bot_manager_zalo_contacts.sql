-- ============================================================================
-- Migration: Bot manager foundations for Zalo contacts and reminder templates
-- Description:
--   1. Create reminder_config if it does not exist and extend it for Zalo usage
--   2. Create bot_user_contacts for Telegram/Zalo bot user tracking and matching
--   3. Allow reminder_logs to dedupe per channel instead of per order only
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reminder_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  t7_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  t3_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  t1_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  channel TEXT NOT NULL DEFAULT 'telegram',
  template_renewal TEXT NOT NULL DEFAULT 'Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm!',
  template_debt TEXT NOT NULL DEFAULT 'Xin chào {customer_name}, bạn đang có công nợ {debt_amount} cần thanh toán trước {due_date}.',
  auto_send BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reminder_config
  ADD COLUMN IF NOT EXISTS template_renewal_internal TEXT NOT NULL DEFAULT '📌 Nhắc hạn đơn {order_code}\nKhách hàng: {customer_name}\nSản phẩm: {product_name}\nHết hạn: {expiry_date}\nCòn {days_left} ngày\nCòn nợ: {balance_due}';

ALTER TABLE public.reminder_config
  ADD COLUMN IF NOT EXISTS template_renewal_zalo TEXT NOT NULL DEFAULT 'Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm để tránh gián đoạn.';

ALTER TABLE public.reminder_config
  ADD COLUMN IF NOT EXISTS template_expired_zalo TEXT NOT NULL DEFAULT 'Xin chào {customer_name}, dịch vụ {product_name} đã hết hạn vào {expiry_date}. Nếu cần tiếp tục sử dụng, bạn vui lòng nhắn lại để được hỗ trợ gia hạn.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_config_account_id
  ON public.reminder_config(account_id);

ALTER TABLE public.reminder_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.reminder_config;
CREATE POLICY "tenant_isolation" ON public.reminder_config
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE TABLE IF NOT EXISTS public.bot_user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  display_name TEXT,
  username TEXT,
  phone TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  auto_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bot_user_contacts_channel_check CHECK (channel IN ('telegram', 'zalo'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_user_contacts_unique_user
  ON public.bot_user_contacts(account_id, channel, external_user_id);

CREATE INDEX IF NOT EXISTS idx_bot_user_contacts_account_channel
  ON public.bot_user_contacts(account_id, channel, last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_user_contacts_customer_id
  ON public.bot_user_contacts(customer_id);

ALTER TABLE public.bot_user_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON public.bot_user_contacts;
CREATE POLICY "tenant_isolation" ON public.bot_user_contacts
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'telegram',
  status TEXT NOT NULL DEFAULT 'sent',
  message_content TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'telegram';

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS message_content TEXT NOT NULL DEFAULT '';

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS sent_date DATE;

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.reminder_logs
SET sent_date = COALESCE(sent_date, (sent_at AT TIME ZONE 'UTC')::date)
WHERE sent_date IS NULL;

CREATE OR REPLACE FUNCTION public.set_reminder_logs_sent_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sent_date := COALESCE(NEW.sent_date, (NEW.sent_at AT TIME ZONE 'UTC')::date);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reminder_logs_sent_date ON public.reminder_logs;
CREATE TRIGGER trg_set_reminder_logs_sent_date
  BEFORE INSERT OR UPDATE OF sent_at, sent_date ON public.reminder_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reminder_logs_sent_date();

CREATE INDEX IF NOT EXISTS idx_rl_order_id
  ON public.reminder_logs(order_id);

CREATE INDEX IF NOT EXISTS idx_rl_customer_id
  ON public.reminder_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_rl_sent_at
  ON public.reminder_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_rl_account
  ON public.reminder_logs(account_id);

DROP INDEX IF EXISTS public.idx_rl_unique_reminder;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rl_unique_reminder_channel
  ON public.reminder_logs(order_id, reminder_type, channel, sent_date);
