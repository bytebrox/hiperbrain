import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store";

describe("MemoryStore", () => {
  it("adds an active fact and finds it by subject+relation", async () => {
    const store = new MemoryStore();
    const r = await store.addFact({ subject: "France", relation: "capital", object: "Paris" });
    expect(r.status).toBe("added");
    expect(r.id).toBeGreaterThan(0);

    const active = await store.findActiveBySR("france", "CAPITAL");
    expect(active?.object).toBe("Paris");
  });

  it("rejects an exact duplicate triple", async () => {
    const store = new MemoryStore();
    await store.addFact({ subject: "Japan", relation: "capital", object: "Tokyo" });
    const dup = await store.addFact({ subject: "Japan", relation: "capital", object: "Tokyo" });
    expect(dup.status).toBe("duplicate");
  });

  it("supersede removes a fact from active recall and records the conflict", async () => {
    const store = new MemoryStore();
    const paris = await store.addFact({ subject: "France", relation: "capital", object: "Paris" });
    const lyon = await store.addFact(
      { subject: "France", relation: "capital", object: "Lyon" },
      { status: "active" },
    );
    await store.supersede(paris.id!, lyon.id!);

    const active = await store.listFacts();
    expect(active.some((f) => f.object === "Paris")).toBe(false);
    expect(active.some((f) => f.object === "Lyon")).toBe(true);
    expect((await store.findActiveBySR("France", "capital"))?.object).toBe("Lyon");

    const disputes = await store.listDisputes();
    expect(disputes[0]).toMatchObject({
      subject: "France",
      relation: "capital",
      losing: "Paris",
      winning: "Lyon",
      status: "superseded",
    });
  });

  it("keeps optional provenance (sourceUrl, verifiedAt) on a fact", async () => {
    const store = new MemoryStore();
    const t = Date.now();
    await store.addFact(
      { subject: "France", relation: "capital", object: "Paris" },
      { sourceUrl: "https://example.com/x", verifiedAt: t },
    );
    const { rows } = await store.listAll({ status: "all", limit: 10, offset: 0 });
    expect(rows[0]).toMatchObject({ sourceUrl: "https://example.com/x", verifiedAt: t });

    const plain = await store.addFact({ subject: "Japan", relation: "capital", object: "Tokyo" });
    expect(plain.status).toBe("added");
    const { rows: all } = await store.listAll({ status: "all", limit: 10, offset: 0 });
    const japan = all.find((r) => r.subject === "Japan");
    expect(japan?.sourceUrl).toBeNull();
    expect(japan?.verifiedAt).toBeNull();
  });

  it("listFacts never returns superseded or disputed facts", async () => {
    const store = new MemoryStore();
    await store.addFact({ subject: "A", relation: "capital", object: "x" }, { status: "active" });
    await store.addFact({ subject: "B", relation: "capital", object: "y" }, { status: "superseded" });
    await store.addFact({ subject: "C", relation: "capital", object: "z" }, { status: "disputed" });

    const active = await store.listFacts();
    expect(active).toHaveLength(1);
    expect(active[0].subject).toBe("A");
    // but capacity counts every row, active or not.
    expect(await store.count()).toBe(3);
  });
});
