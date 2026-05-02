import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** Service-role client; only created when env is present (avoids build-time failures). */
export function getSupabaseAdmin(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (!cached) {
    cached = createClient(config.url, config.key, { auth: { persistSession: false } });
  }
  return cached;
}

export function functionsUrl(path: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error('SUPABASE_URL is required');
  return `${config.url}/functions/v1/${path}`;
}

export function serviceAuthHeader() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return { Authorization: `Bearer ${config.key}` };
}
