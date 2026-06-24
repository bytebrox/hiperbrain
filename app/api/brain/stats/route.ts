/**
 * Lightweight stats for the collective brain (fact / concept / relation counts).
 *
 *   GET /api/brain/stats  ->  { facts, concepts, relations, capacity }
 *
 * Served from the cached server-side brain so the homepage and activity log can
 * show live counters without downloading a single fact.
 */

import { NextResponse } from "next/server";
import { getServerBrain } from "@/lib/server/brain-server";
import { MAX_FACTS } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const brain = await getServerBrain();
  const stats = brain.stats();
  return NextResponse.json(
    { ...stats, capacity: MAX_FACTS },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=300" } },
  );
}
