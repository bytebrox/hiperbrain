/**
 * Metered write endpoint — teach the collective brain a fact via the API.
 *
 *   POST /api/v1/teach   (Authorization: Bearer <key>)
 *   body: { subject, relation, object }
 *   -> { status: "added" | "replaced" | "duplicate" | "superseded" | "disputed", total, remaining }
 *
 * Costs CREDITS_COST_TEACH credits. The charge is refunded whenever the
 * submission does not land as a new active fact (duplicate, rejected, full, or
 * lost/uncertain in a contradiction), so users only pay for knowledge that
 * actually enters the brain.
 */

import { NextResponse } from "next/server";
import { validateFact } from "@/lib/server/moderation";
import { invalidateFactsCache, MAX_FACTS } from "@/lib/server/store";
import { landedActive, teachFact } from "@/lib/server/teach";
import {
  bearerToken,
  COST_TEACH,
  refundCredits,
  spendCredits,
  walletForKey,
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

  // Charge first (atomic), then run the teach pipeline; refund if nothing
  // active landed.
  let remaining = await spendCredits(key, COST_TEACH);
  if (remaining < 0) {
    return NextResponse.json(
      { error: "Out of credits, or unknown API key. Burn tokens to top up." },
      { status: 402 },
    );
  }

  const owner = await walletForKey(key);
  const outcome = await teachFact(result.fact, { source: "api", owner });

  if (!landedActive(outcome)) {
    await refundCredits(key, COST_TEACH);
    remaining += COST_TEACH;
  } else {
    invalidateFactsCache();
  }

  switch (outcome.kind) {
    case "rejected":
      return NextResponse.json(
        { error: `That doesn't appear to be correct: ${outcome.reason}`, verdict: "false", remaining },
        { status: 422 },
      );
    case "full":
      return NextResponse.json(
        { error: `The brain is at capacity (${MAX_FACTS} facts).`, remaining },
        { status: 409 },
      );
    case "duplicate":
      return NextResponse.json({
        status: "duplicate",
        fact: outcome.fact,
        total: outcome.total,
        remaining,
      });
    case "superseded":
      return NextResponse.json({
        status: "superseded",
        fact: outcome.fact,
        reason: outcome.reason,
        total: outcome.total,
        remaining,
      });
    case "disputed":
      return NextResponse.json({
        status: "disputed",
        fact: outcome.fact,
        reason: outcome.reason,
        total: outcome.total,
        remaining,
      });
    case "replaced":
      return NextResponse.json(
        { status: "replaced", fact: outcome.fact, reason: outcome.reason, total: outcome.total, remaining },
        { status: 201 },
      );
    default:
      return NextResponse.json(
        { status: "added", fact: outcome.fact, total: outcome.total, remaining },
        { status: 201 },
      );
  }
}
