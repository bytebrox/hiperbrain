/**
 * Un-metered recall for the website demo.
 *
 *   POST /api/brain/query
 *   body: { kind: "ask" | "analogy" | "neighbors", ... }
 *
 * The collective brain is far too large to ship to every browser and rebuild
 * there, so recall runs against the server-side brain (cached per instance) and
 * the client only sends a small query and renders the answer. The response is
 * normalised so the command bar can render every state, and carries a `trace`
 * the 3D graph animates.
 */

import { NextResponse } from "next/server";
import { recallConfidence } from "@hiperbrain/core";
import { getServerBrain } from "@/lib/server/brain-server";
import { canonicalRelation } from "@/lib/relation-aliases";

export const dynamic = "force-dynamic";
// Building the brain on a cold instance can take tens of seconds at scale; give
// the function room before it is reused (warm) for every subsequent query.
export const maxDuration = 60;

interface Trace {
  kind: "ask" | "analogy" | "neighbors";
  focus: string[];
  answer: string | null;
  relation: string | null;
  segments: [string, string][];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const trimItem = (m: { name: string; score: number }) => ({ name: m.name, score: m.score });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const kind = str(body.kind);
  const brain = await getServerBrain();

  if (kind === "ask") {
    const subject = str(body.subject);
    const relation = canonicalRelation(str(body.relation));
    if (!subject || !relation) {
      return NextResponse.json({ error: "subject and relation are required." }, { status: 400 });
    }
    const matches = brain.ask(subject, relation, 4);
    const conf = recallConfidence(matches);
    if (!conf.confident) {
      return NextResponse.json({ kind, confident: false });
    }
    const trace: Trace = {
      kind: "ask",
      focus: [subject],
      answer: matches[0].name,
      relation,
      segments: [[subject, matches[0].name]],
    };
    return NextResponse.json({
      kind,
      confident: true,
      answer: matches[0].name,
      relation,
      score: conf.score,
      sigma: conf.sigma,
      others: matches.slice(1).filter((m) => m.score > 0.05).map(trimItem),
      trace,
    });
  }

  if (kind === "analogy") {
    const value = str(body.value);
    const from = str(body.from);
    const to = str(body.to);
    if (!value || !from || !to) {
      return NextResponse.json({ error: "value, from and to are required." }, { status: 400 });
    }
    const matches = brain.analogy(value, from, to, 4);
    const conf = recallConfidence(matches);
    if (!conf.confident) {
      return NextResponse.json({ kind, confident: false });
    }
    const recovered = brain.recoverRelation(value, from, 1)[0]?.name ?? null;
    const trace: Trace = {
      kind: "analogy",
      focus: [from, to, value],
      answer: matches[0].name,
      relation: recovered,
      segments: [
        [from, to],
        [value, matches[0].name],
      ],
    };
    return NextResponse.json({
      kind,
      confident: true,
      answer: matches[0].name,
      relation: recovered,
      score: conf.score,
      sigma: conf.sigma,
      others: matches.slice(1).filter((m) => m.score > 0.05).map(trimItem),
      trace,
    });
  }

  if (kind === "neighbors") {
    const entity = str(body.entity);
    if (!entity) {
      return NextResponse.json({ error: "entity is required." }, { status: 400 });
    }
    const neighbors = brain.similarConcepts(entity, 6).filter((m) => m.score > 0.05).map(trimItem);
    const trace: Trace | null =
      neighbors.length > 0
        ? {
            kind: "neighbors",
            focus: [entity],
            answer: null,
            relation: null,
            segments: neighbors.slice(0, 3).map((m) => [entity, m.name] as [string, string]),
          }
        : null;
    return NextResponse.json({ kind, entity, neighbors, trace });
  }

  return NextResponse.json({ error: "Unknown query kind." }, { status: 400 });
}
