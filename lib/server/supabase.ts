/**
 * Server-side Supabase client using the service-role key.
 *
 * The service role bypasses Row Level Security, so this client is the ONLY way
 * facts get written and the only thing that can touch the rate-limit table. It
 * must never be exposed to the browser - keep `SUPABASE_SERVICE_ROLE_KEY`
 * server-only (no `NEXT_PUBLIC_` prefix).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}
