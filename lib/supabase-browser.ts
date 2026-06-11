"use client";

/**
 * Browser Supabase client using the public anon key.
 *
 * Used only to subscribe to realtime fact inserts so the brain and logs update
 * live. The anon key is safe to expose; Row Level Security restricts the anon
 * role to reading facts. Returns null when Supabase is not configured (local
 * development), in which case the app simply runs without live updates.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}
