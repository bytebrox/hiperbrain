/**
 * A shared pool of example inputs, grouped by what they demonstrate. Used by the
 * example chips, the mode switcher templates and the animated placeholder so the
 * suggestions stay varied instead of always showing the same four.
 */

export type ExampleKind = "ask" | "teach" | "reason";

export interface Example {
  kind: ExampleKind;
  text: string;
}

export const KIND_LABEL: Record<ExampleKind, string> = {
  ask: "Ask",
  teach: "Teach",
  reason: "Reason",
};

export const KIND_HINT: Record<ExampleKind, string> = {
  ask: "Ask about something the brain knows",
  teach: "Tell the brain a new fact",
  reason: "Make it reason by analogy",
};

export const EXAMPLES: Example[] = [
  // Ask - phrased many different ways on purpose.
  { kind: "ask", text: "capital of Japan" },
  { kind: "ask", text: "currency of France" },
  { kind: "ask", text: "What is the capital of Brazil?" },
  { kind: "ask", text: "continent of Egypt" },
  { kind: "ask", text: "language of Mexico" },
  { kind: "ask", text: "symbol of Gold" },
  { kind: "ask", text: "opposite of hot" },
  { kind: "ask", text: "Italy's capital" },
  { kind: "ask", text: "tell me the currency of Japan" },
  { kind: "ask", text: "landmark of France" },
  // Synonyms and verb phrasing - resolved to the canonical relation.
  { kind: "ask", text: "money of Japan" },
  { kind: "ask", text: "capital city of Brazil" },

  // Teach - shows the three accepted phrasings (canonical, reversed, possessive).
  { kind: "teach", text: "Madrid is the capital of Spain" },
  { kind: "teach", text: "the author of Hamlet is Shakespeare" },
  { kind: "teach", text: "Canada's capital is Ottawa" },
  { kind: "teach", text: "the director of Jaws is Spielberg" },
  { kind: "teach", text: "currency of Sweden is Krona" },
  { kind: "teach", text: "the painter of the Mona Lisa is Leonardo" },

  // Reason - analogies it was never explicitly taught, plus semantic neighbours.
  { kind: "reason", text: "USA is to Dollar as Japan is to ?" },
  { kind: "reason", text: "France is to Paris as Italy is to ?" },
  { kind: "reason", text: "Germany is to Berlin as Spain is to ?" },
  { kind: "reason", text: "Gold is to Au as Iron is to ?" },
  { kind: "reason", text: "Brazil is to Portuguese as Mexico is to ?" },
  { kind: "reason", text: "Japan is to Tokyo as Egypt is to ?" },
  { kind: "reason", text: "concepts like France" },
  { kind: "reason", text: "similar to Gold" },
  { kind: "reason", text: "concepts like Japan" },
];

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A shuffled selection that always contains a mix of all three kinds. Call this
 * only on the client (it uses Math.random) to avoid hydration mismatches.
 */
export function pickExamples(count = 6): Example[] {
  const byKind: Record<ExampleKind, Example[]> = {
    ask: shuffle(EXAMPLES.filter((e) => e.kind === "ask")),
    teach: shuffle(EXAMPLES.filter((e) => e.kind === "teach")),
    reason: shuffle(EXAMPLES.filter((e) => e.kind === "reason")),
  };
  // Guarantee one of each, then fill the rest from a shuffled remainder.
  const picked: Example[] = [byKind.ask[0], byKind.teach[0], byKind.reason[0]];
  const used = new Set(picked.map((e) => e.text));
  const rest = shuffle(EXAMPLES.filter((e) => !used.has(e.text)));
  for (const e of rest) {
    if (picked.length >= count) break;
    picked.push(e);
  }
  return shuffle(picked).slice(0, count);
}

/** A random example template for a given mode (client-only). */
export function templateFor(kind: ExampleKind): string {
  const pool = EXAMPLES.filter((e) => e.kind === kind);
  return pool[Math.floor(Math.random() * pool.length)].text;
}
