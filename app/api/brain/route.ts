/**
 * Collective brain API.
 *
 *   GET  /api/brain  -> the shared facts plus a count, so the client can
 *                       rebuild the brain locally. Cached briefly in-process.
 *   POST /api/brain  -> teach the brain a new fact. The submission is rate
 *                       limited, validated and moderated before being stored.
 */

import { NextResponse } from "next/server";
import { validateFact } from "@/lib/server/moderation";
import { getFactsCached, invalidateFactsCache, MAX_FACTS } from "@/lib/server/store";
import { checkRateLimit } from "@/lib/server/ratelimit";
import { landedActive, parseSourceUrl, teachFact } from "@/lib/server/teach";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "anonymous";
}

export async function GET() {
  const facts = await getFactsCached();
  return NextResponse.json(
    { facts, total: facts.length, capacity: MAX_FACTS },
    {
      headers: {
        // Let Vercel's CDN serve a shared snapshot so Supabase is hit at most
        // ~once per window regardless of traffic, and let browsers reuse it
        // across navigations. Clients stay current via the realtime stream, so
        // a slightly stale initial snapshot is fine.
        "Cache-Control":
          "public, max-age=10, s-maxage=30, stale-while-revalidate=300",
      },
    },
  );
}

export async function POST(request: Request) {
  const { success } = await checkRateLimit(clientIp(request));
  if (!success) {
    return NextResponse.json(
      { error: "You are teaching too fast. Please slow down and try again shortly." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = validateFact(body as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Verify, resolve contradictions and store. Only confident-false is rejected;
  // conflicts on single-valued relations are adjudicated rather than blocked.
  const sourceUrl = parseSourceUrl((body as { source_url?: unknown }).source_url);
  const outcome = await teachFact(result.fact, { source: "community", sourceUrl });
  if (landedActive(outcome)) invalidateFactsCache();

  switch (outcome.kind) {
    case "rejected":
      return NextResponse.json(
        { error: `That doesn't appear to be correct, so it wasn't added: ${outcome.reason}`, verdict: "false" },
        { status: 422 },
      );
    case "full":
      return NextResponse.json(
        { error: `The brain is at capacity (${MAX_FACTS} facts).` },
        { status: 409 },
      );
    case "duplicate":
      return NextResponse.json(
        { status: "duplicate", fact: outcome.fact, total: outcome.total },
        { status: 200 },
      );
    case "superseded":
      return NextResponse.json(
        { status: "superseded", fact: outcome.fact, reason: outcome.reason, total: outcome.total },
        { status: 200 },
      );
    case "disputed":
      return NextResponse.json(
        { status: "disputed", fact: outcome.fact, reason: outcome.reason, total: outcome.total },
        { status: 200 },
      );
    case "replaced":
      return NextResponse.json(
        { status: "replaced", fact: outcome.fact, reason: outcome.reason, total: outcome.total },
        { status: 201 },
      );
    default:
      return NextResponse.json(
        { status: "added", fact: outcome.fact, total: outcome.total },
        { status: 201 },
      );
  }
}
