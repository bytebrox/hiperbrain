/**
 * Parses one line of natural-ish input into a question, a new fact, or an
 * analogy. The grammar is intentionally tiny, but the parser is forgiving so
 * visitors can type the way they speak instead of learning a command syntax.
 *
 * All of these resolve to the SAME ask, for "capital of France":
 *   "capital of France"
 *   "What is the capital of France?"
 *   "tell me the capital of France"
 *   "France's capital"
 *
 * All of these teach the SAME fact:
 *   "capital of Spain is Madrid"
 *   "Madrid is the capital of Spain"
 *   "Spain's capital is Madrid"
 *
 * Analogy:
 *   "USA is to Dollar as Mexico is to ?"
 */

export type Command =
  | { kind: "empty" }
  | { kind: "ask"; subject: string; relation: string }
  | { kind: "teach"; subject: string; relation: string; object: string }
  | { kind: "analogy"; from: string; value: string; to: string }
  | { kind: "neighbors"; entity: string }
  | { kind: "invalid"; message: string };

const ASK_HINT = 'Try: "capital of France"';
const TEACH_HINT = 'Try: "Madrid is the capital of Spain"';

// "<A> is to <B> as <C>" with an optional trailing "is to" (the "?" is stripped).
const ANALOGY_RE = /^(.+?)\s+is\s+to\s+(.+?)\s+as\s+(.+?)(?:\s+is\s+to)?\s*$/i;

// "concepts like France" / "like France" / "similar to France" / "related to X".
const NEIGHBORS_RE =
  /^(?:concepts?\s+|things?\s+)?(?:like|similar\s+to|related\s+to|close\s+to)\s+(.+)$/i;

// Possessive: "France's capital" / "France’s capital".
const POSSESSIVE_RE = /^(.+?)['’]s\s+(.+)$/;

// Leading politeness / question framing we can safely drop. Longest first so
// "what is the" wins over "what is".
const QUESTION_PREFIXES = [
  "what is the",
  "what are the",
  "what's the",
  "whats the",
  "what is",
  "what are",
  "what's",
  "whats",
  "who is the",
  "who's the",
  "who is",
  "who's",
  "where is the",
  "where's the",
  "where is",
  "where's",
  "tell me the",
  "tell me",
  "show me the",
  "show me",
  "give me the",
  "give me",
  "do you know the",
  "do you know",
  "please",
];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Drop a single leading article ("the", "a", "an"). */
function stripArticle(text: string): string {
  return text.replace(/^(the|a|an)\s+/i, "").trim();
}

/** Iteratively remove leading question/politeness framing. */
function stripQuestionPrefix(text: string): string {
  let t = text;
  let changed = true;
  while (changed) {
    changed = false;
    const lower = t.toLowerCase();
    for (const p of QUESTION_PREFIXES) {
      if (lower === p) return "";
      if (lower.startsWith(`${p} `)) {
        t = t.slice(p.length).trim();
        changed = true;
        break;
      }
    }
  }
  return t;
}

/** Split "<relation> of <subject>" at the first " of ". Strips articles. */
function splitOf(text: string): { relation: string; subject: string } | null {
  const idx = text.toLowerCase().indexOf(" of ");
  if (idx === -1) return null;
  const relation = stripArticle(text.slice(0, idx).trim());
  const subject = stripArticle(text.slice(idx + 4).trim());
  if (!relation || !subject) return null;
  return { relation, subject };
}

/** Split "<owner>'s <attribute>" into relation/subject. */
function splitPossessive(text: string): { relation: string; subject: string } | null {
  const m = POSSESSIVE_RE.exec(text);
  if (!m) return null;
  const subject = stripArticle(m[1].trim());
  const relation = stripArticle(m[2].trim());
  if (!relation || !subject) return null;
  return { relation, subject };
}

export function parseCommand(raw: string): Command {
  const cleaned = collapse(raw).replace(/\?+\s*$/, "").trim();
  if (!cleaned) return { kind: "empty" };

  // Analogy first - it also contains " is ".
  const analogy = ANALOGY_RE.exec(cleaned);
  if (analogy) {
    const from = analogy[1].trim();
    const value = analogy[2].trim();
    const to = analogy[3].trim();
    if (from && value && to) return { kind: "analogy", from, value, to };
  }

  // Semantic neighbours: "concepts like France".
  const neighbors = NEIGHBORS_RE.exec(cleaned);
  if (neighbors) {
    const entity = stripArticle(neighbors[1].trim());
    if (entity) return { kind: "neighbors", entity };
  }

  const text = stripQuestionPrefix(cleaned);
  if (!text) return { kind: "empty" };

  // Teach: the presence of " is " (or " = ") turns a phrase into a statement.
  const lower = text.toLowerCase();
  const isIdx = lower.lastIndexOf(" is ");
  const eqIdx = text.indexOf(" = ");
  const splitIdx = isIdx !== -1 ? isIdx : eqIdx;
  const sepLen = isIdx !== -1 ? 4 : 3;

  if (splitIdx !== -1) {
    const left = text.slice(0, splitIdx).trim();
    const right = text.slice(splitIdx + sepLen).trim();
    if (!left || !right) return { kind: "invalid", message: TEACH_HINT };

    // "<relation> of <subject> is <object>"
    const leftOf = splitOf(left);
    if (leftOf) {
      return { kind: "teach", subject: leftOf.subject, relation: leftOf.relation, object: right };
    }
    // "<object> is the <relation> of <subject>"
    const rightOf = splitOf(stripArticle(right));
    if (rightOf) {
      return { kind: "teach", subject: rightOf.subject, relation: rightOf.relation, object: left };
    }
    // "<subject>'s <relation> is <object>"
    const poss = splitPossessive(left);
    if (poss) {
      return { kind: "teach", subject: poss.subject, relation: poss.relation, object: right };
    }
    return { kind: "invalid", message: TEACH_HINT };
  }

  // Ask: "<relation> of <subject>" or "<subject>'s <relation>".
  const ofSplit = splitOf(text);
  if (ofSplit) return { kind: "ask", subject: ofSplit.subject, relation: ofSplit.relation };

  const poss = splitPossessive(text);
  if (poss) return { kind: "ask", subject: poss.subject, relation: poss.relation };

  return { kind: "invalid", message: ASK_HINT };
}
