/**
 * Runs the fixed public benchmark against the live brain, server-side.
 *
 *   GET /api/brain/benchmark  ->  { results, summary }
 *
 * The benchmark scores dozens of queries against the full collective brain.
 * Running it on the server keeps the heavy recall off the visitor's device and
 * lets it cover the entire knowledge base rather than a browser-sized slice.
 */

import { NextResponse } from "next/server";
import { getServerBrain } from "@/lib/server/brain-server";
import { runBenchmark } from "@/lib/benchmark";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const brain = await getServerBrain();
  const { results, summary } = runBenchmark(brain);
  return NextResponse.json(
    { results, summary },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } },
  );
}
