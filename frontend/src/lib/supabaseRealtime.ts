import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Supabase Realtime client for the admin generation dashboard. The browser
 * connects to Supabase directly ONLY for the generation_runs_live table
 * (CDC via Postgres logical replication — migration 0019 RLS policy restricts
 * to admin/superadmin, and the table carries ZERO PII).
 *
 * Every other Vault interaction goes through Core (service role) as always.
 * This is an architectural exception in the same class as Depot's public
 * file route and Pulse's tracker scripts (AGENTS.md §1.5).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
