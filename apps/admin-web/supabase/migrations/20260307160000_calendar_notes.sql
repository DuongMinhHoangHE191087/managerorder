-- Up
CREATE TABLE IF NOT EXISTS public.calendar_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    content TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(account_id)
);

-- RLS
ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own calendar notes"
    ON public.calendar_notes FOR SELECT
    USING (account_id IN (
        SELECT account_id FROM admin_users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can upsert own calendar notes"
    ON public.calendar_notes FOR ALL
    USING (account_id IN (
        SELECT account_id FROM admin_users WHERE id = auth.uid()
    ));
