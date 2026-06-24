import { describe, expect, it } from "vitest";
import { KnowledgeBrain, type Fact } from "./knowledge";

describe("KnowledgeBrain collective memory", () => {
  it("recalls a learned object from subject + relation", () => {
    const brain = new KnowledgeBrain();
    brain.learn({ subject: "Paris", relation: "capitalOf", object: "France" });
    brain.learn({ subject: "Tokyo", relation: "capitalOf", object: "Japan" });

    expect(brain.ask("Paris", "capitalOf")[0].name).toBe("France");
    expect(brain.ask("Tokyo", "capitalOf")[0].name).toBe("Japan");
  });

  it("answers the reverse question", () => {
    const brain = new KnowledgeBrain();
    brain.learn({ subject: "Paris", relation: "capitalOf", object: "France" });
    expect(brain.askSubject("capitalOf", "France")[0].name).toBe("Paris");
  });

  it("is additive and order-independent", () => {
    const facts: Fact[] = [
      { subject: "dog", relation: "says", object: "woof" },
      { subject: "cat", relation: "says", object: "meow" },
      { subject: "cow", relation: "says", object: "moo" },
    ];
    const a = KnowledgeBrain.fromFacts(facts);
    const b = KnowledgeBrain.fromFacts([...facts].reverse());
    expect(a.ask("cat", "says")[0].name).toBe("meow");
    expect(b.ask("cat", "says")[0].name).toBe("meow");
  });

  it("retains recall accuracy at a moderate collective scale", () => {
    const facts: Fact[] = [];
    for (let i = 0; i < 60; i++) {
      facts.push({ subject: `s${i}`, relation: "maps", object: `o${i}` });
    }
    const brain = KnowledgeBrain.fromFacts(facts);

    let correct = 0;
    for (let i = 0; i < 60; i++) {
      if (brain.ask(`s${i}`, "maps")[0].name === `o${i}`) correct++;
    }
    // A single bundled vector holds dozens of facts with high accuracy.
    expect(correct).toBeGreaterThanOrEqual(58);
  });

  it("solves analogies across entities (the 'Dollar of Mexico' trick)", () => {
    const facts: Fact[] = [
      { subject: "USA", relation: "capital", object: "Washington" },
      { subject: "USA", relation: "currency", object: "Dollar" },
      { subject: "USA", relation: "language", object: "English" },
      { subject: "Mexico", relation: "capital", object: "MexicoCity" },
      { subject: "Mexico", relation: "currency", object: "Peso" },
      { subject: "Mexico", relation: "language", object: "Spanish" },
      { subject: "Japan", relation: "capital", object: "Tokyo" },
      { subject: "Japan", relation: "currency", object: "Yen" },
      { subject: "Japan", relation: "language", object: "Japanese" },
    ];
    const brain = KnowledgeBrain.fromFacts(facts);

    // currency of USA is Dollar -> corresponding filler of Mexico is Peso
    expect(brain.analogy("Dollar", "USA", "Mexico")[0].name).toBe("Peso");
    // capital analogy
    expect(brain.analogy("Washington", "USA", "Mexico")[0].name).toBe("MexicoCity");
    // works for any pair of entities
    expect(brain.analogy("Yen", "Japan", "Mexico")[0].name).toBe("Peso");
    expect(brain.analogy("Tokyo", "Japan", "USA")[0].name).toBe("Washington");
  });

  it("keeps analogies accurate with many entities", () => {
    const data: [string, string, string, string][] = [
      ["France", "Paris", "Euro", "French"],
      ["Japan", "Tokyo", "Yen", "Japanese"],
      ["USA", "Washington", "Dollar", "English"],
      ["Mexico", "MexicoCity", "Peso", "Spanish"],
      ["Brazil", "Brasilia", "Real", "Portuguese"],
      ["India", "NewDelhi", "Rupee", "Hindi"],
      ["China", "Beijing", "Yuan", "Mandarin"],
      ["Russia", "Moscow", "Ruble", "Russian"],
      ["Egypt", "Cairo", "Pound", "Arabic"],
      ["Kenya", "Nairobi", "Shilling", "Swahili"],
      ["Sweden", "Stockholm", "Krona", "Swedish"],
      ["Turkey", "Ankara", "Lira", "Turkish"],
    ];
    const facts: Fact[] = [];
    for (const [country, capital, currency, language] of data) {
      facts.push({ subject: country, relation: "capital", object: capital });
      facts.push({ subject: country, relation: "currency", object: currency });
      facts.push({ subject: country, relation: "language", object: language });
    }
    const brain = KnowledgeBrain.fromFacts(facts);

    expect(brain.analogy("Yen", "Japan", "France")[0].name).toBe("Euro");
    expect(brain.analogy("Paris", "France", "Japan")[0].name).toBe("Tokyo");
    expect(brain.analogy("Dollar", "USA", "Brazil")[0].name).toBe("Real");
  });

  it("finds similar concepts by shared properties (records of varying size)", () => {
    // France & Germany share a currency (Euro) and continent (Europe); Japan is
    // on its own. Records here have 1, 2 and 3 facts, exercising every packed
    // record path (single XOR, two-way majority, dense majority).
    const facts: Fact[] = [
      { subject: "France", relation: "currency", object: "Euro" },
      { subject: "France", relation: "continent", object: "Europe" },
      { subject: "France", relation: "language", object: "French" },
      { subject: "Germany", relation: "currency", object: "Euro" },
      { subject: "Germany", relation: "continent", object: "Europe" },
      { subject: "Japan", relation: "currency", object: "Yen" },
    ];
    const brain = KnowledgeBrain.fromFacts(facts);
    // Germany should be France's nearest neighbour (two shared fillers).
    expect(brain.similarConcepts("France", 2)[0].name).toBe("Germany");
    expect(brain.similarConcepts("Germany", 1)[0].name).toBe("France");
  });

  it("reports stats about its knowledge", () => {
    const brain = new KnowledgeBrain();
    brain.learn({ subject: "Paris", relation: "capitalOf", object: "France" });
    brain.learn({ subject: "Berlin", relation: "capitalOf", object: "Germany" });
    const stats = brain.stats();
    expect(stats.facts).toBe(2);
    expect(stats.concepts).toBe(4);
    expect(stats.relations).toBe(1);
  });
});
