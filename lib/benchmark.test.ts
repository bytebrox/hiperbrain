import { describe, expect, it } from "vitest";
import { KnowledgeBrain } from "@hiperbrain/core";
import { runBenchmark, scoreItem } from "./benchmark";
import { SEED_FACTS } from "./server/store";

function seededBrain(): KnowledgeBrain {
  const brain = new KnowledgeBrain();
  for (const f of SEED_FACTS) brain.learn(f);
  return brain;
}

describe("benchmark scoring", () => {
  it("scores a known fact as correct", () => {
    const brain = seededBrain();
    const r = scoreItem(brain, {
      kind: "ask",
      subject: "France",
      relation: "capital",
      expected: "Paris",
    });
    expect(r.status).toBe("correct");
    expect(r.confident).toBe(true);
  });

  it("abstains on an unknown fact instead of guessing", () => {
    const brain = seededBrain();
    const r = scoreItem(brain, {
      kind: "ask",
      subject: "Mars",
      relation: "capital",
      expected: "Olympus",
    });
    expect(r.status).toBe("abstain");
  });

  it("never reports a confident-wrong answer on the seeded brain", () => {
    const { summary } = runBenchmark(seededBrain());
    // The seed knowledge is all correct, so the brain is either right or it
    // abstains - it must never be confidently wrong.
    expect(summary.confidentWrong).toBe(0);
    expect(summary.correct).toBeGreaterThan(10);
    expect(summary.accuracy).toBeGreaterThan(0);
  });
});
