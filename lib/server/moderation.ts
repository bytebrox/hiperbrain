/**
 * Input validation and content moderation for community-taught facts.
 *
 * The brain is public and writable, so everything a visitor submits is
 * validated and filtered server-side before it is allowed into the shared
 * memory. This keeps the collective brain from being flooded with garbage or
 * abuse. The checks here are deliberately simple and conservative; they are a
 * first line of defence, not a complete moderation system.
 */

import type { Fact } from "@/lib/hdc";

export const FIELD_MAX_LENGTH = 40;
export const FIELD_MIN_LENGTH = 1;

/** Letters (any language), digits, spaces and a few separators are allowed. */
const ALLOWED_PATTERN = /^[\p{L}\p{N} '\-_.]+$/u;

/**
 * A small blocklist of obviously abusive substrings (English and German).
 * Matched case-insensitively against the normalised input. This is intentionally
 * short; extend it or swap in a dedicated moderation service for production use.
 */
const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "nigger",
  "faggot",
  "cunt",
  "retard",
  "rape",
  "nazi",
  "hitler",
  "arschloch",
  "fotze",
  "hurensohn",
  "wichser",
  "schlampe",
];

export interface ValidationOk {
  ok: true;
  fact: Fact;
}

export interface ValidationError {
  ok: false;
  error: string;
}

export type ValidationResult = ValidationOk | ValidationError;

/** Collapse whitespace and trim. Relations are lowercased for consistency. */
function normalizeField(value: unknown, lowercase = false): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return lowercase ? cleaned.toLowerCase() : cleaned;
}

function validateField(value: string, label: string): string | null {
  if (value.length < FIELD_MIN_LENGTH) return `The ${label} is required.`;
  if (value.length > FIELD_MAX_LENGTH) {
    return `The ${label} must be at most ${FIELD_MAX_LENGTH} characters.`;
  }
  if (!ALLOWED_PATTERN.test(value)) {
    return `The ${label} contains unsupported characters.`;
  }
  // Reject low-information input such as "aaaa" or "----".
  const distinct = new Set(value.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase());
  if (distinct.size < 2) return `The ${label} looks like nonsense.`;
  return null;
}

function containsBlockedTerm(text: string): boolean {
  const haystack = text.toLowerCase();
  return BLOCKLIST.some((term) => haystack.includes(term));
}

/**
 * Validate and normalise a raw, untrusted fact submission. Returns either a
 * cleaned `Fact` ready to be stored, or a human-readable error message.
 */
export function validateFact(input: {
  subject?: unknown;
  relation?: unknown;
  object?: unknown;
}): ValidationResult {
  const subject = normalizeField(input.subject);
  const relation = normalizeField(input.relation, true);
  const object = normalizeField(input.object);

  for (const [value, label] of [
    [subject, "subject"],
    [relation, "relation"],
    [object, "object"],
  ] as const) {
    const error = validateField(value, label);
    if (error) return { ok: false, error };
  }

  if (subject.toLowerCase() === object.toLowerCase()) {
    return { ok: false, error: "Subject and object must be different." };
  }

  if (containsBlockedTerm(`${subject} ${relation} ${object}`)) {
    return { ok: false, error: "That submission was blocked by the content filter." };
  }

  return { ok: true, fact: { subject, relation, object } };
}

/**
 * A stable, case-insensitive key used to detect duplicate facts. Matches the
 * generated `fact_key` column in the Postgres schema. The "|" separator is safe
 * because it is not part of the allowed character set.
 */
export function factKey({ subject, relation, object }: Fact): string {
  return [subject, relation, object].map((s) => s.toLowerCase()).join("|");
}
