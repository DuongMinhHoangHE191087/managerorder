import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Database migration endpoint.
 * Adds missing auth columns to admin_users table.
 * Secured by CRON_SECRET.
 * 
 * Usage: GET /api/migrate?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized or missing CRON_SECRET' }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // Check current schema by trying to select specific columns
    const { data: testData } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .limit(1);

    const currentCols = testData && testData.length > 0 ? Object.keys(testData[0]) : [];
    results.push(`Current columns: ${currentCols.join(', ')}`);

    // Test each missing column
    const missingCols: string[] = [];
    for (const col of ['password_hash', 'first_name', 'last_name', 'status']) {
      const { error } = await supabaseAdmin
        .from('admin_users')
        .select(col)
        .limit(1);
      if (error) {
        missingCols.push(col);
      }
    }

    if (missingCols.length === 0) {
      results.push('All required columns exist ✅');
      return NextResponse.json({ status: 'ok', results });
    }

    results.push(`Missing columns: ${missingCols.join(', ')}`);

    // Try to add columns via RPC (if exists)
    const { error: rpcError } = await supabaseAdmin.rpc('run_auth_migration', {});
    
    if (rpcError) {
      results.push(`RPC not available: ${rpcError.message}`);
      results.push('Please run the SQL migration manually in Supabase Dashboard');
    } else {
      results.push('Migration RPC executed successfully ✅');
    }

    return NextResponse.json({
      status: missingCols.length > 0 ? 'migration_needed' : 'ok',
      results,
      missingCols,
      sql: `
-- Run this in Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/ucqmmgopljyugxojntjv/sql/new

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE admin_users 
SET 
  first_name = split_part(COALESCE(display_name, email), ' ', 1),
  last_name = CASE 
    WHEN display_name IS NOT NULL AND position(' ' in display_name) > 0 
    THEN substring(display_name from position(' ' in display_name) + 1)
    ELSE ''
  END,
  status = 'active'
WHERE first_name IS NULL;

-- Create migration function for future use
CREATE OR REPLACE FUNCTION run_auth_migration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS first_name TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_name TEXT;
  ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  
  UPDATE admin_users 
  SET first_name = split_part(COALESCE(display_name, email), ' ', 1),
      last_name = CASE 
        WHEN display_name IS NOT NULL AND position(' ' in display_name) > 0 
        THEN substring(display_name from position(' ' in display_name) + 1)
        ELSE ''
      END,
      status = 'active'
  WHERE first_name IS NULL;
END;
$$;
      `,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown',
      results,
    }, { status: 500 });
  }
}
