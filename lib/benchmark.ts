/**
 * A fixed, public benchmark for the collective brain.
 *
 * Each item is a question with a known correct answer. Running it against the
 * live brain yields three honest numbers:
 *   - accuracy  : how often the brain's top answer is correct.
 *   - precision : how often it is correct WHEN it chose to answer confidently.
 *   - confident-wrong (the HDC analogue of hallucination): how often it answered
 *     confidently but was wrong. A well-calibrated brain keeps this near zero by
 *     abstaining instead of guessing.
 *
 * The set is grounded in the seed knowledge (so it is meaningful even on a fresh
 * brain) plus broader general knowledge that a well-fed brain should know.
 * Questions the brain hasn't learned simply count as abstentions, which is the
 * correct behaviour for an associative memory - it says "I don't know" rather
 * than inventing an answer.
 */

import { type KnowledgeBrain, recallConfidence } from "@hiperbrain/core";

export interface BenchmarkAsk {
  kind: "ask";
  subject: string;
  relation: string;
  expected: string;
}

export interface BenchmarkAnalogy {
  kind: "analogy";
  /** "from is to value as to is to ???" */
  from: string;
  value: string;
  to: string;
  expected: string;
}

export type BenchmarkItem = BenchmarkAsk | BenchmarkAnalogy;

export const BENCHMARK: BenchmarkItem[] = [
  // --- Capitals (seed-guaranteed) ---
  { kind: "ask", subject: "France", relation: "capital", expected: "Paris" },
  { kind: "ask", subject: "Japan", relation: "capital", expected: "Tokyo" },
  { kind: "ask", subject: "Germany", relation: "capital", expected: "Berlin" },
  { kind: "ask", subject: "Egypt", relation: "capital", expected: "Cairo" },
  { kind: "ask", subject: "Canada", relation: "capital", expected: "Ottawa" },
  // --- Currencies (seed-guaranteed) ---
  { kind: "ask", subject: "France", relation: "currency", expected: "Euro" },
  { kind: "ask", subject: "Japan", relation: "currency", expected: "Yen" },
  { kind: "ask", subject: "USA", relation: "currency", expected: "Dollar" },
  { kind: "ask", subject: "Mexico", relation: "currency", expected: "Peso" },
  { kind: "ask", subject: "India", relation: "currency", expected: "Rupee" },
  // --- Animal sounds (seed-guaranteed) ---
  { kind: "ask", subject: "Dog", relation: "sound", expected: "Woof" },
  { kind: "ask", subject: "Cat", relation: "sound", expected: "Meow" },
  { kind: "ask", subject: "Cow", relation: "sound", expected: "Moo" },
  { kind: "ask", subject: "Duck", relation: "sound", expected: "Quack" },
  // --- Colors (seed-guaranteed) ---
  { kind: "ask", subject: "Sky", relation: "color", expected: "Blue" },
  { kind: "ask", subject: "Grass", relation: "color", expected: "Green" },
  { kind: "ask", subject: "Sun", relation: "color", expected: "Yellow" },
  { kind: "ask", subject: "Snow", relation: "color", expected: "White" },
  // --- Analogies derived purely from seed records ---
  { kind: "analogy", from: "USA", value: "Dollar", to: "Mexico", expected: "Peso" },
  { kind: "analogy", from: "France", value: "Paris", to: "Japan", expected: "Tokyo" },
  { kind: "analogy", from: "Dog", value: "Woof", to: "Cat", expected: "Meow" },
  { kind: "analogy", from: "France", value: "Euro", to: "Japan", expected: "Yen" },
  // --- Broader general knowledge (answered by a well-fed brain, else abstained) ---
  { kind: "ask", subject: "Italy", relation: "capital", expected: "Rome" },
  { kind: "ask", subject: "Spain", relation: "capital", expected: "Madrid" },
  { kind: "ask", subject: "Russia", relation: "capital", expected: "Moscow" },
  { kind: "ask", subject: "China", relation: "capital", expected: "Beijing" },
  { kind: "ask", subject: "Brazil", relation: "capital", expected: "Brasilia" },
  { kind: "ask", subject: "Australia", relation: "capital", expected: "Canberra" },
  { kind: "ask", subject: "Greece", relation: "capital", expected: "Athens" },
  { kind: "ask", subject: "Portugal", relation: "capital", expected: "Lisbon" },
  { kind: "ask", subject: "China", relation: "currency", expected: "Yuan" },
  { kind: "ask", subject: "Russia", relation: "currency", expected: "Ruble" },
  { kind: "ask", subject: "Brazil", relation: "currency", expected: "Real" },
];

export type ItemStatus = "correct" | "wrong" | "abstain";

export interface ItemResult {
  item: BenchmarkItem;
  status: ItemStatus;
  /** The brain's top answer (may be wrong or low-confidence). */
  got: string | null;
  confident: boolean;
}

export interface BenchmarkSummary {
  total: number;
  correct: number;
  /** Confident answers (the brain committed to an answer). */
  answered: number;
  /** Confident but wrong - the hallucination analogue. */
  confidentWrong: number;
  abstained: number;
  /** correct / total. */
  accuracy: number;
  /** correct / answered (quality of confident answers). */
  precision: number;
  /** confidentWrong / total. */
  hallucinationRate: number;
  /** answered / total. */
  coverage: number;
}

function eq(a: string | null, b: string): boolean {
  return !!a && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Score a single benchmark item against the live brain. Pure and deterministic. */
export function scoreItem(brain: KnowledgeBrain, item: BenchmarkItem): ItemResult {
  const matches =
    item.kind === "ask"
      ? brain.ask(item.subject, item.relation.toLowerCase(), 4)
      : brain.analogy(item.value, item.from, item.to, 4);

  const conf = recallConfidence(matches);
  const got = matches[0]?.name ?? null;
  const isCorrect = eq(got, item.expected);

  if (!conf.confident) return { item, status: "abstain", got, confident: false };
  return { item, status: isCorrect ? "correct" : "wrong", got, confident: true };
}

/** Run the whole benchmark and aggregate the headline metrics. */
export function runBenchmark(brain: KnowledgeBrain, items: BenchmarkItem[] = BENCHMARK): {
  results: ItemResult[];
  summary: BenchmarkSummary;
} {
  const results = items.map((item) => scoreItem(brain, item));
  const total = results.length;
  const correct = results.filter((r) => r.status === "correct").length;
  const confidentWrong = results.filter((r) => r.status === "wrong").length;
  const abstained = results.filter((r) => r.status === "abstain").length;
  const answered = correct + confidentWrong;

  const summary: BenchmarkSummary = {
    total,
    correct,
    answered,
    confidentWrong,
    abstained,
    accuracy: total ? correct / total : 0,
    precision: answered ? correct / answered : 0,
    hallucinationRate: total ? confidentWrong / total : 0,
    coverage: total ? answered / total : 0,
  };
  return { results, summary };
}
