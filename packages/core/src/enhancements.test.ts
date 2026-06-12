import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  DIMENSIONS,
  seededHypervector,
} from "./hypervector";
import {
  bindPacked,
  hammingPacked,
  packBits,
  similarityPacked,
  unpackBits,
} from "./bitpack";
import { KnowledgeBrain, recallConfidence, type Fact } from "./knowledge";
import { ConceptResolver } from "./resolver";

describe("bit-packed hypervectors", () => {
  it("round-trips bipolar <-> packed", () => {
    const v = seededHypervector("round-trip");
    const back = unpackBits(packBits(v), v.length);
    expect([...back]).toEqual([...v]);
  });

  it("packed similarity matches cosine similarity exactly", () => {
    const a = seededHypervector("alpha");
    const b = seededHypervector("beta");
    const packed = similarityPacked(packBits(a), packBits(b), DIMENSIONS);
    expect(packed).toBeCloseTo(cosineSimilarity(a, b), 10);
  });

  it("packed bind equals bipolar bind (XOR is multiply)", () => {
    const a = seededHypervector("x");
    const b = seededHypervector("y");
    const bound = unpackBits(bindPacked(packBits(a), packBits(b)), DIMENSIONS);
    for (let i = 0; i < DIMENSIONS; i++) {
      expect(bound[i]).toBe((a[i] * b[i]) as -1 | 1);
    }
  });

  it("identical vectors have zero Hamming distance", () => {
    const a = seededHypervector("same");
    expect(hammingPacked(packBits(a), packBits(a))).toBe(0);
  });
});

describe("collision-resistant seeding", () => {
  it("keeps thousands of distinct labels near-orthogonal", () => {
    let maxAbs = 0;
    const base = seededHypervector("anchor");
    for (let i = 0; i < 2000; i++) {
      const v = seededHypervector(`concept-${i}`);
      maxAbs = Math.max(maxAbs, Math.abs(cosineSimilarity(base, v)));
    }
    // No accidental near-duplicate of the anchor across 2000 labels.
    expect(maxAbs).toBeLessThan(0.1);
  });
});

describe("explainable analogy", () => {
  const facts: Fact[] = [
    { subject: "USA", relation: "capital", object: "Washington" },
    { subject: "USA", relation: "currency", object: "Dollar" },
    { subject: "USA", relation: "language", object: "English" },
    { subject: "Mexico", relation: "capital", object: "MexicoCity" },
    { subject: "Mexico", relation: "currency", object: "Peso" },
    { subject: "Mexico", relation: "language", object: "Spanish" },
  ];

  it("recovers the relation behind an analogy", () => {
    const brain = KnowledgeBrain.fromFacts(facts);
    expect(brain.recoverRelation("Dollar", "USA")[0].name).toBe("currency");
    expect(brain.recoverRelation("Washington", "USA")[0].name).toBe("capital");
  });
});

describe("semantic neighbourhood", () => {
  it("ranks entities that share fillers as similar", () => {
    const facts: Fact[] = [
      { subject: "France", relation: "currency", object: "Euro" },
      { subject: "France", relation: "continent", object: "Europe" },
      { subject: "Germany", relation: "currency", object: "Euro" },
      { subject: "Germany", relation: "continent", object: "Europe" },
      { subject: "Japan", relation: "currency", object: "Yen" },
      { subject: "Japan", relation: "continent", object: "Asia" },
    ];
    const brain = KnowledgeBrain.fromFacts(facts);
    // Germany shares both fillers with France, Japan shares none.
    expect(brain.similarConcepts("France")[0].name).toBe("Germany");
  });
});

describe("calibrated confidence", () => {
  it("is confident for a clean recall and unsure for an empty result", () => {
    const brain = new KnowledgeBrain();
    brain.learn({ subject: "Paris", relation: "capitalOf", object: "France" });
    const conf = recallConfidence(brain.ask("Paris", "capitalOf"));
    expect(conf.confident).toBe(true);
    expect(recallConfidence([]).confident).toBe(false);
  });
});

describe("typo-tolerant resolver", () => {
  it("maps a misspelling to the closest known concept", () => {
    const resolver = new ConceptResolver(["France", "Germany", "Japan", "Brazil"]);
    expect(resolver.resolve("Frnace")?.name).toBe("France");
    expect(resolver.resolve("germany")?.name).toBe("Germany");
  });

  it("returns null for something genuinely unknown", () => {
    const resolver = new ConceptResolver(["France", "Germany"]);
    expect(resolver.resolve("xyzzy-qwerty")).toBeNull();
  });
});
