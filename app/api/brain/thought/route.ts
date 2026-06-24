/**
 * The brain's current "thought fingerprint" — a single hypervector summarising
 * everything it knows — for the activity-log heatmap.
 *
 *   GET /api/brain/thought  ->  { vector: number[] }  (length = dimensions)
 *
 * Computed server-side so the client renders the fingerprint without holding a
 * brain. The payload is a ~10k-element ±1 array (a few KB), not the facts.
 */

import { NextResponse } from "next/server";
import { getServerBrain } from "@/lib/server/brain-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const brain = await getServerBrain();
  const vector = Array.from(brain.thoughtVector());
  return NextResponse.json(
    { vector },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=300" } },
  );
}
