/**
 * Lightweight stats for the collective brain (fact / concept / relation counts).
 *
 *   GET /api/brain/stats  ->  { facts, concepts, relations, capacity }
 *
 * Counted directly in the database (see supabase/stats.sql) so the homepage and
 * activity log get live counters without downloading facts or building the
 * brain. If the SQL stats function is not installed, the exact fact count is
 * still served instantly and concepts/relations are filled from a warm brain
 * when one exists on this instance.
 */

import { NextResponse } from "next/server";
import { peekBrainCounts } from "@/lib/server/brain-server";
import { getStore, MAX_FACTS } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const store = getStore();
  await store.ensureSeeded();
  const counts = await store.counts();

  if (counts.concepts === 0 && counts.relations === 0) {
    const warm = peekBrainCounts();
    if (warm) {
      counts.concepts = warm.concepts;
      counts.relations = warm.relations;
    }
  }

  return NextResponse.json(
    { ...counts, capacity: MAX_FACTS },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=300" } },
  );
}
