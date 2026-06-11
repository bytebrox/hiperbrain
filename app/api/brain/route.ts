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
import {
  getFactsCached,
  getStore,
  invalidateFactsCache,
  MAX_FACTS,
} from "@/lib/server/store";
import { checkRateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "anonymous";
}

export async function GET() {
  const facts = await getFactsCached();
  return NextResponse.json({ facts, total: facts.length, capacity: MAX_FACTS });
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

  const store = getStore();
  await store.ensureSeeded();
  const added = await store.addFact(result.fact);

  if (added.status === "full") {
    return NextResponse.json(
      { error: `The brain is at capacity (${MAX_FACTS} facts).` },
      { status: 409 },
    );
  }
  if (added.status === "duplicate") {
    return NextResponse.json(
      { status: "duplicate", fact: result.fact, total: added.total },
      { status: 200 },
    );
  }

  invalidateFactsCache();
  return NextResponse.json(
    { status: "added", fact: result.fact, total: added.total },
    { status: 201 },
  );
}
