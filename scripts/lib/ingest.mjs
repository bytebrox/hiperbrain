/**
 * Shared ingest helpers for the brain seeders.
 *
 * Every seeder turns some data source into (subject, relation, object) triples
 * and upserts them into Supabase. This module centralises the parts that MUST
 * stay identical across seeders so the data we write is always exactly what the
 * live app would accept:
 *
 *   - sanitization / normalization (mirrors the app's moderation rules)
 *   - case-insensitive de-duplication (mirrors the generated `fact_key` column)
 *   - idempotent, chunked upsert via `onConflict: "fact_key"`
 *
 * Keep `ALLOWED`, `MAX_LEN` and the normalization rules in sync with the
 * server-side moderation so seeded facts and user-taught facts are governed by
 * one definition of "valid".
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Characters allowed in any field of a triple. Letters and numbers in any
 * script, plus space, apostrophe, hyphen, underscore and period. This is the
 * same character class the app's moderation enforces, so anything we seed could
 * also have been taught through the API.
 */
export const ALLOWED = /^[\p{L}\p{N} '\-_.]+$/u;

/** Max length (characters) of any single field. */
export const MAX_LEN = 40;

/** A Wikidata/label fallback like "Q12345" — never a real fact value. */
const QID = /^Q\d+$/;

/** Collapse whitespace and trim. */
export function normalize(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate + normalize a single triple. Returns the cleaned triple or `null` if
 * it should be skipped. Relations are lower-cased (the app buckets by relation
 * and treats them case-insensitively).
 */
export function cleanTriple(subject, relation, object) {
  const s = normalize(subject);
  const r = normalize(relation).toLowerCase();
  const o = normalize(object);

  if (!s || !r || !o) return null;
  if (s.length > MAX_LEN || r.length > MAX_LEN || o.length > MAX_LEN) return null;
  if (QID.test(s) || QID.test(o)) return null; // unlabelled entity, not a fact
  if (![s, r, o].every((x) => ALLOWED.test(x))) return null;
  if (s.toLowerCase() === o.toLowerCase()) return null; // trivial self-reference

  return { subject: s, relation: r, object: o };
}

/**
 * Clean + de-duplicate an array of raw `{ subject, relation, object }` rows.
 * Returns the unique, valid facts plus how many were skipped.
 */
export function dedupe(raw) {
  const seen = new Set();
  const facts = [];
  let skipped = 0;

  for (const f of raw) {
    const clean = cleanTriple(f.subject, f.relation, f.object);
    if (!clean) {
      skipped += 1;
      continue;
    }
    const key = `${clean.subject.toLowerCase()}|${clean.relation}|${clean.object.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(clean);
  }

  return { facts, skipped };
}

/**
 * Verify the Supabase env is present, exiting with a hint if not. Call this at
 * the very top of a seeder — before any network I/O — so a misconfigured run
 * exits cleanly instead of tearing down with open sockets.
 */
export function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing Supabase env. Run with:\n  node --env-file=.env.local <script>",
    );
    process.exit(1);
  }
  return { url, key };
}

/** Build a service-role Supabase client from env, or exit with a hint. */
export function getSupabase() {
  const { url, key } = requireEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Total number of rows in the `facts` table. */
export async function countFacts(supabase) {
  const { count } = await supabase
    .from("facts")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Idempotently upsert facts in chunks. Duplicates (by the generated `fact_key`)
 * are ignored, so this is safe to run repeatedly and alongside other seeders.
 */
export async function upsertFacts(supabase, facts, { chunkSize = 500 } = {}) {
  for (let i = 0; i < facts.length; i += chunkSize) {
    const chunk = facts.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("facts")
      .upsert(chunk, { onConflict: "fact_key", ignoreDuplicates: true });
    if (error) {
      console.error("Upsert failed:", error);
      process.exit(1);
    }
  }
  return facts.length;
}

/** Run a full clean → upsert pass and print a before/after summary. */
export async function seed(rawFacts, { label = "facts" } = {}) {
  const supabase = getSupabase();
  const { facts, skipped } = dedupe(rawFacts);
  const relations = [...new Set(facts.map((f) => f.relation))];

  const before = await countFacts(supabase);
  await upsertFacts(supabase, facts);
  const after = await countFacts(supabase);

  console.log(
    `Prepared ${facts.length} unique ${label} across ${relations.length} relations (skipped ${skipped}).`,
  );
  console.log("  " + relations.join(", "));
  console.log(`Facts in DB before: ${before}  ->  after: ${after}  (+${after - before})`);
}
