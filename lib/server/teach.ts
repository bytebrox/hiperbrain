/**
 * Shared teach pipeline: verify a fact, resolve contradictions, then store it.
 *
 * Both the public website endpoint (`/api/brain`) and the metered API
 * (`/api/v1/teach`) run the exact same knowledge logic through here; they only
 * differ in their transport concerns (rate limiting vs. credit billing).
 *
 * Flow for a single submission:
 *   1. Fact-check (verifyFact). A confident "false" is rejected outright.
 *   2. If the relation is functional (single-valued) and an active value
 *      already exists with a *different* object, ask the model which value is
 *      correct (adjudicate):
 *        - "new"       -> insert the new value active, supersede the old one.
 *        - "existing"  -> keep the old value; record the new one as superseded.
 *        - "uncertain" -> keep the old value active; record the new one as
 *                         disputed (so a single unverified claim cannot knock a
 *                         good answer out of recall).
 *   3. Otherwise insert as a normal active fact (duplicates handled by the
 *      unique fact_key).
 *
 * Only `active` facts ever reach the brain's vectors, so contradictions never
 * corrupt recall.
 */

import type { Fact } from "@hiperbrain/core";
import { getStore, type AddResult, type FactSource } from "./store";
import { isFunctional } from "./relations";
import { adjudicate, isVerificationEnabled, verifyFact } from "./verify-fact";

export type TeachResult =
  | { kind: "rejected"; reason: string }
  | { kind: "added"; fact: Fact; total: number; id?: number }
  | { kind: "replaced"; fact: Fact; reason: string; total: number; id?: number }
  | { kind: "superseded"; fact: Fact; reason: string; total: number }
  | { kind: "disputed"; fact: Fact; reason: string; total: number }
  | { kind: "duplicate"; fact: Fact; total: number }
  | { kind: "full"; total: number };

/** Did this outcome put a new active fact into the shared brain? */
export function landedActive(result: TeachResult): boolean {
  return result.kind === "added" || result.kind === "replaced";
}

function mapAdd(added: AddResult, fact: Fact): TeachResult {
  if (added.status === "full") return { kind: "full", total: added.total };
  if (added.status === "duplicate") return { kind: "duplicate", fact, total: added.total };
  return { kind: "added", fact, total: added.total, id: added.id };
}

function confidenceFor(verdict: string | null): number | null {
  if (verdict === "true") return 0.9;
  if (verdict === "uncertain") return 0.5;
  return null;
}

export async function teachFact(
  fact: Fact,
  meta: { source: FactSource; owner?: string | null },
): Promise<TeachResult> {
  // 1. Fact-check. Only a confident "false" blocks the submission.
  let verdict: string | null = null;
  if (isVerificationEnabled()) {
    const check = await verifyFact(fact);
    if (check.verdict === "false") return { kind: "rejected", reason: check.reason };
    verdict = check.verdict;
  }
  const confidence = confidenceFor(verdict);
  const base = { source: meta.source, owner: meta.owner ?? null, verdict, confidence };

  const store = getStore();
  await store.ensureSeeded();

  // 2. Contradiction handling for single-valued relations.
  if (isFunctional(fact.relation)) {
    const existing = await store.findActiveBySR(fact.subject, fact.relation);
    if (existing && existing.object.toLowerCase() !== fact.object.toLowerCase()) {
      const ruling = await adjudicate(fact.subject, fact.relation, existing.object, fact.object);

      if (ruling.winner === "new") {
        const added = await store.addFact(fact, { ...base, status: "active", note: ruling.reason });
        if (added.status === "added" && added.id) {
          await store.supersede(existing.id, added.id);
          return { kind: "replaced", fact, reason: ruling.reason, total: added.total, id: added.id };
        }
        return mapAdd(added, fact);
      }

      if (ruling.winner === "existing") {
        const added = await store.addFact(fact, {
          ...base,
          status: "superseded",
          note: ruling.reason,
          supersededBy: existing.id,
        });
        if (added.status === "added") {
          return { kind: "superseded", fact, reason: ruling.reason, total: added.total };
        }
        return mapAdd(added, fact);
      }

      // uncertain: keep the established value, log the new one as disputed.
      const added = await store.addFact(fact, { ...base, status: "disputed", note: ruling.reason });
      if (added.status === "added") {
        return { kind: "disputed", fact, reason: ruling.reason, total: added.total };
      }
      return mapAdd(added, fact);
    }
  }

  // 3. No conflict: a normal active insert (duplicates handled by fact_key).
  const added = await store.addFact(fact, { ...base, status: "active" });
  return mapAdd(added, fact);
}
