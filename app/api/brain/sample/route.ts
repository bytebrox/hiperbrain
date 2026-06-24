/**
 * A bounded sample of facts for the 3D brain visualisation.
 *
 *   GET /api/brain/sample?limit=1500  ->  { facts }
 *
 * The canvas only renders a degree-ranked subgraph (~80 nodes), so it never
 * needs the whole brain. We return the oldest facts (the densely-connected seed
 * + early world knowledge), which makes for a lively, well-connected graph while
 * keeping the payload tiny no matter how large the brain grows.
 */

import { NextResponse } from "next/server";
import { getFactsCached } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_LIMIT = 1500;
const MAX_LIMIT = 4000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const all = await getFactsCached();
  const facts = all.slice(0, limit).map((f) => ({
    subject: f.subject,
    relation: f.relation,
    object: f.object,
  }));

  return NextResponse.json(
    { facts, total: all.length },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } },
  );
}
