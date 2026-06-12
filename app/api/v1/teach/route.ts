/**
 * Metered write endpoint — teach the collective brain a fact via the API.
 *
 *   POST /api/v1/teach   (Authorization: Bearer <key>)
 *   body: { subject, relation, object }
 *   -> { status: "added" | "duplicate", total, remaining }
 *
 * Costs CREDITS_COST_TEACH credits (writes are AI-verified and permanent, so
 * they cost more than a read). The charge is refunded if the fact is a
 * duplicate or rejected, so users only pay for facts that actually land.
 */

import { NextResponse } from "next/server";
import { validateFact } from "@/lib/server/moderation";
import { getStore, invalidateFactsCache, MAX_FACTS } from "@/lib/server/store";
import { isVerificationEnabled, verifyFact } from "@/lib/server/verify-fact";
import {
  bearerToken,
  COST_TEACH,
  refundCredits,
  spendCredits,
} from "@/lib/server/credits";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = bearerToken(request);
  if (!key) return NextResponse.json({ error: "Missing API key." }, { status: 401 });

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

  if (isVerificationEnabled()) {
    const check = await verifyFact(result.fact);
    if (check.verdict === "false") {
      return NextResponse.json(
        { error: `That doesn't appear to be correct: ${check.reason}`, verdict: check.verdict },
        { status: 422 },
      );
    }
  }

  // Charge first (atomic), then write. Refund if the write doesn't add a fact.
  const remaining = await spendCredits(key, COST_TEACH);
  if (remaining < 0) {
    return NextResponse.json(
      { error: "Out of credits, or unknown API key. Burn tokens to top up." },
      { status: 402 },
    );
  }

  const store = getStore();
  await store.ensureSeeded();
  const added = await store.addFact(result.fact);

  if (added.status !== "added") {
    await refundCredits(key, COST_TEACH); // duplicate or full: don't charge
    if (added.status === "full") {
      return NextResponse.json(
        { error: `The brain is at capacity (${MAX_FACTS} facts).`, remaining: remaining + COST_TEACH },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { status: "duplicate", fact: result.fact, total: added.total, remaining: remaining + COST_TEACH },
    );
  }

  invalidateFactsCache();
  return NextResponse.json(
    { status: "added", fact: result.fact, total: added.total, remaining },
    { status: 201 },
  );
}
