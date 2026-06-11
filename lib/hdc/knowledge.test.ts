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
