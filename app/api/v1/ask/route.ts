/**
 * Metered recall endpoint — the paid entry point to the collective brain.
 *
 *   POST /api/v1/ask   (Authorization: Bearer <key>)
 *   body: { subject, relation, k? }
 *   -> { answer, matches, confidence, remaining }
 *
 * Costs CREDITS_COST_ASK credits per call, debited atomically before the brain
 * is queried. Returns 402 when the key is out of credits.
 */

import { NextResponse } from "next/server";
import { recallConfidence } from "@hiperbrain/core";
import { bearerToken, COST_ASK, spendCredits } from "@/lib/server/credits";
import { getServerBrain } from "@/lib/server/brain-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = bearerToken(request);
  if (!key) return NextResponse.json({ error: "Missing API key." }, { status: 401 });

  let body: { subject?: unknown; relation?: unknown; k?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const relation = typeof body.relation === "string" ? body.relation.trim() : "";
  const k = Math.min(Math.max(Number(body.k) || 5, 1), 10);
  if (!subject || !relation) {
    return NextResponse.json({ error: "subject and relation are required." }, { status: 400 });
  }

  const remaining = await spendCredits(key, COST_ASK);
  if (remaining < 0) {
    return NextResponse.json(
      { error: "Out of credits, or unknown API key. Burn tokens to top up." },
      { status: 402 },
    );
  }

  const brain = await getServerBrain();
  const matches = brain.ask(subject, relation, k);
  const confidence = recallConfidence(matches);

  return NextResponse.json({
    answer: matches[0]?.name ?? null,
    matches,
    confidence,
    remaining,
  });
}
