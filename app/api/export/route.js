import { createClient } from '@supabase/supabase-js';
import { getTodayKstDateKey } from '@/lib/dateTime';
import { handleCsvExportRequest } from '@/lib/csvExport.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request) {
  return handleCsvExportRequest(request, {
    createClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    getDateKey: getTodayKstDateKey,
  });
}
