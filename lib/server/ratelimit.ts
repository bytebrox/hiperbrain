/**
 * Per-IP rate limiting backed by a Postgres table (`rate_events`).
 *
 * Each write attempt logs an event; a request is allowed only if the IP has
 * made at most MAX_WRITES attempts within WINDOW_SECONDS. The table is
 * server-only (RLS with no policies), so only the service-role client here can
 * read or write it. Without Supabase configured (local dev) it allows all.
 */

import { getServiceClient } from "./supabase";

const MAX_WRITES = 10;
const WINDOW_SECONDS = 60;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const client = getServiceClient();
  if (!client) return { success: true, remaining: MAX_WRITES };

  // Occasionally prune old events to keep the table small.
  if (Math.random() < 0.1) {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await client.from("rate_events").delete().lt("created_at", cutoff);
  }

  await client.from("rate_events").insert({ ip });

  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
  const { count } = await client
    .from("rate_events")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);

  const used = count ?? 0;
  return { success: used <= MAX_WRITES, remaining: Math.max(0, MAX_WRITES - used) };
}
