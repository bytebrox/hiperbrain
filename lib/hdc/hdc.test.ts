import { describe, expect, it } from "vitest";
import {
  bind,
  bundle,
  cosineSimilarity,
  corrupt,
  DIMENSIONS,
  mulberry32,
  permute,
  randomHypervector,
  seededHypervector,
} from "./hypervector";
import { ItemMemory } from "./itemMemory";
import { Brain } from "./brain";

const rng = mulberry32(42);

describe("hypervector primitives", () => {
  it("creates bipolar vectors of the requested size", () => {
    const v = randomHypervector(DIMENSIONS, rng);
    expect(v.length).toBe(DIMENSIONS);
    expect([...v].every((x) => x === -1 || x === 1)).toBe(true);
  });

  it("seeds deterministically from a label", () => {
    const a = seededHypervector("apple");
    const b = seededHypervector("apple");
    const c = seededHypervector("banana");
    expect(cosineSimilarity(a, b)).toBe(1);
    expect(Math.abs(cosineSimilarity(a, c))).toBeLessThan(0.1);
  });

  it("makes random vectors approximately orthogonal", () => {
    const a = randomHypervector(DIMENSIONS, rng);
    const b = randomHypervector(DIMENSIONS, rng);
    expect(Math.abs(cosineSimilarity(a, b))).toBeLessThan(0.1);
  });

  it("binding is its own inverse and dissimilar to inputs", () => {
    const a = randomHypervector(DIMENSIONS, rng);
    const b = randomHypervector(DIMENSIONS, rng);
    const bound = bind(a, b);
    expect(Math.abs(cosineSimilarity(bound, a))).toBeLessThan(0.1);
    expect(cosineSimilarity(bind(bound, b), a)).toBe(1);
  });

  it("bundling stays similar to every input", () => {
    const a = randomHypervector(DIMENSIONS, rng);
    const b = randomHypervector(DIMENSIONS, rng);
    const c = randomHypervector(DIMENSIONS, rng);
    const set = bundle([a, b, c]);
    expect(cosineSimilarity(set, a)).toBeGreaterThan(0.3);
    expect(cosineSimilarity(set, b)).toBeGreaterThan(0.3);
    expect(cosineSimilarity(set, c)).toBeGreaterThan(0.3);
  });

  it("permutation produces a dissimilar but reversible vector", () => {
    const a = randomHypervector(DIMENSIONS, rng);
    const shifted = permute(a, 3);
    expect(Math.abs(cosineSimilarity(a, shifted))).toBeLessThan(0.1);
    expect(cosineSimilarity(permute(shifted, -3), a)).toBe(1);
  });

  it("degrades gracefully under corruption", () => {
    const a = randomHypervector(DIMENSIONS, rng);
    const noisy = corrupt(a, 0.3, rng);
    // Flipping 30% of bits should leave the vector clearly recognizable.
    expect(cosineSimilarity(a, noisy)).toBeGreaterThan(0.3);
  });
});

describe("item memory cleanup", () => {
  it("recovers the closest stored symbol from a noisy query", () => {
    const memory = new ItemMemory();
    const names = ["cat", "dog", "fish", "bird"];
    for (const name of names) memory.add(name, seededHypervector(name));

    const noisy = corrupt(seededHypervector("dog"), 0.25, rng);
    expect(memory.cleanup(noisy)?.name).toBe("dog");
  });
});

describe("brain analogical reasoning", () => {
  it("answers 'the Dollar of Mexico' with vector algebra", () => {
    const brain = new Brain();
    brain.learnRecord("USA", {
      capital: "Washington",
      currency: "Dollar",
      language: "English",
    });
    brain.learnRecord("Mexico", {
      capital: "MexicoCity",
      currency: "Peso",
      language: "Spanish",
    });

    const answer = brain.analogy("USA", "Mexico", "Dollar");
    expect(answer[0].name).toBe("Peso");
  });
});

describe("brain one-shot classification", () => {
  it("learns languages from a few examples and classifies new text", () => {
    const brain = new Brain();
    brain.learnClass("english", [
      "the quick brown fox jumps over the lazy dog",
      "this is a simple english sentence about the weather",
    ]);
    brain.learnClass("spanish", [
      "el rapido zorro marron salta sobre el perro perezoso",
      "esta es una frase sencilla en espanol sobre el clima",
    ]);

    expect(brain.classify("the weather is nice today")[0].name).toBe("english");
    expect(brain.classify("el clima esta agradable hoy")[0].name).toBe(
      "spanish",
    );
  });
});

describe("brain sequence memory", () => {
  it("replays a stored sequence by position", () => {
    const brain = new Brain();
    const seq = ["red", "green", "blue", "yellow"];
    const encoded = brain.encodeSequence(seq);
    expect(brain.replaySequence(encoded, seq.length)).toEqual(seq);
  });

  it("predicts the next element from a transition memory", () => {
    const brain = new Brain();
    const seq = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const transitions = brain.encodeTransitions(seq);
    expect(brain.predictNext(transitions, "monday")[0].name).toBe("tuesday");
    expect(brain.predictNext(transitions, "thursday")[0].name).toBe("friday");
  });
});

describe("brain persistence", () => {
  it("round-trips through JSON", () => {
    const brain = new Brain();
    brain.learnRecord("USA", { currency: "Dollar" });
    brain.learnRecord("Mexico", { currency: "Peso" });

    const restored = Brain.fromJSON(JSON.parse(JSON.stringify(brain.toJSON())));
    expect(restored.analogy("USA", "Mexico", "Dollar")[0].name).toBe("Peso");
  });
});
