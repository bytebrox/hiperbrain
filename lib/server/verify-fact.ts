/**
 * Optional fact verification with OpenAI.
 *
 * A community-taught fact is a triple (subject, relation, object) that reads as
 * "The <relation> of <subject> is <object>." Before such a claim enters the
 * shared brain we can ask a language model whether it is factually correct.
 *
 * Design notes:
 *  - This is *fail-open*: if no API key is set, or the request errors / times
 *    out, we return "uncertain" so submissions are never blocked by infra
 *    problems. Only a confident "false" verdict should reject a fact.
 *  - We use the plain REST API via fetch (no SDK dependency) and a small, fast,
 *    cheap model with deterministic settings.
 */

import type { Fact } from "@hiperbrain/core";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 12000;

export type Verdict = "true" | "false" | "uncertain";

export interface VerifyResult {
  verdict: Verdict;
  reason: string;
}

const SYSTEM_PROMPT = `You are a strict but fair fact-checker for a public knowledge base.
You receive a claim of the form: The <relation> of <subject> is <object>.
Decide whether the claim is factually correct according to well-established, general world knowledge.

Verdict rules:
- "true": the claim is correct and well established.
- "false": the claim is clearly incorrect or contradicts well-established facts.
- "uncertain": you cannot verify it, OR it is ambiguous, subjective, opinion-based, fictional, about a very obscure/private entity, or time-sensitive in a way you cannot confirm.

Be tolerant of spelling, phrasing and language; judge the underlying real-world claim, not the wording.
When unsure, prefer "uncertain" over "false". Only use "false" when you are confident the claim is wrong.

Respond ONLY as compact JSON: {"verdict":"true"|"false"|"uncertain","reason":"<one short sentence>"}.`;

const ADJUDICATE_SYSTEM_PROMPT = `You are a strict but fair fact-checker resolving a conflict in a public knowledge base.
For a single subject and relation there can be only ONE correct object (e.g. a country has one capital).
You are given the value the knowledge base currently holds ("existing") and a newly submitted value ("new").

Decide which value is factually correct according to well-established, general world knowledge:
- "existing": the value already stored is correct (and the new one is wrong).
- "new": the newly submitted value is correct (and the stored one is wrong/outdated).
- "uncertain": you cannot confidently tell which is right, both could be valid phrasings of the same answer, or neither is clearly correct.

Be tolerant of spelling, phrasing and language; judge the underlying real-world claim, not the wording.
When unsure, prefer "uncertain". 

Respond ONLY as compact JSON: {"winner":"existing"|"new"|"uncertain","reason":"<one short sentence>"}.`;

/** Whether fact verification is configured (an OpenAI key is present). */
export function isVerificationEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function normalizeVerdict(value: unknown): Verdict {
  return value === "true" || value === "false" ? value : "uncertain";
}

/**
 * Low-level call to the chat completions API that returns the assistant's
 * message content string, or null on any failure. Never throws.
 */
async function callModel(systemPrompt: string, userContent: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = JSON.stringify({
    model: MODEL,
    // gpt-5 family: reasoning tokens count toward the completion budget, so keep
    // headroom; it uses `max_completion_tokens` and only the default temperature.
    max_completion_tokens: 2000,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  try {
    let res: Response | null = null;
    // Retry once on a transient rate-limit (429) before giving up.
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status !== 429) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
    }

    if (!res || !res.ok) return null;
    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}

/**
 * Ask the model whether a fact is correct. Never throws: on any failure it
 * resolves to an "uncertain" verdict so the caller can decide to let it through.
 */
export async function verifyFact(fact: Fact): Promise<VerifyResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { verdict: "uncertain", reason: "Verification is disabled." };
  }

  const claim = `The ${fact.relation} of ${fact.subject} is ${fact.object}.`;
  const content = await callModel(
    SYSTEM_PROMPT,
    `Claim: "${claim}"\nTriple: subject="${fact.subject}", relation="${fact.relation}", object="${fact.object}"`,
  );
  if (content === null) {
    return { verdict: "uncertain", reason: "Checker unavailable." };
  }

  try {
    const parsed = JSON.parse(content) as { verdict?: unknown; reason?: unknown };
    const verdict = normalizeVerdict(parsed.verdict);
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "No reason given.";
    return { verdict, reason };
  } catch {
    return { verdict: "uncertain", reason: "Checker returned no content." };
  }
}

export type Winner = "existing" | "new" | "uncertain";

export interface AdjudicateResult {
  winner: Winner;
  reason: string;
}

function normalizeWinner(value: unknown): Winner {
  return value === "existing" || value === "new" ? value : "uncertain";
}

/**
 * Resolve a contradiction on a functional relation: given the value currently
 * stored and a conflicting new value, decide which is correct. Fail-open: on
 * any error (or no API key) it returns "uncertain", so the caller keeps both
 * facts as disputed rather than guessing.
 */
export async function adjudicate(
  subject: string,
  relation: string,
  existingObject: string,
  newObject: string,
): Promise<AdjudicateResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { winner: "uncertain", reason: "Adjudication is disabled." };
  }

  const content = await callModel(
    ADJUDICATE_SYSTEM_PROMPT,
    `Subject: "${subject}"\nRelation: "${relation}"\nExisting value: "${existingObject}"\nNew value: "${newObject}"\nWhich value is the correct ${relation} of ${subject}?`,
  );
  if (content === null) {
    return { winner: "uncertain", reason: "Adjudicator unavailable." };
  }

  try {
    const parsed = JSON.parse(content) as { winner?: unknown; reason?: unknown };
    const winner = normalizeWinner(parsed.winner);
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "No reason given.";
    return { winner, reason };
  } catch {
    return { winner: "uncertain", reason: "Adjudicator returned no content." };
  }
}
