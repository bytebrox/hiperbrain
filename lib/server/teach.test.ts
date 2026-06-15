import { describe, expect, it } from "vitest";
import { teachFact } from "./teach";
import { getStore } from "./store";

// These tests run without an OPENAI_API_KEY (vitest does not load .env.local),
// so verification and adjudication both fail open to "uncertain". A conflicting
// functional fact is therefore recorded as `disputed` while the established
// value is kept active - which is exactly the safe, deterministic behaviour we
// want to lock in. Unique subjects keep tests independent of the shared store.

describe("teachFact", () => {
  it("adds a brand-new fact as active", async () => {
    const r = await teachFact(
      { subject: "Zogland", relation: "capital", object: "Zef" },
      { source: "community" },
    );
    expect(r.kind).toBe("added");
  });

  it("reports an exact duplicate", async () => {
    await teachFact({ subject: "Quland", relation: "capital", object: "Qux" }, { source: "community" });
    const r = await teachFact(
      { subject: "Quland", relation: "capital", object: "Qux" },
      { source: "community" },
    );
    expect(r.kind).toBe("duplicate");
  });

  it("keeps multi-valued relations as independent active facts", async () => {
    const a = await teachFact(
      { subject: "Xland", relation: "language", object: "Xish" },
      { source: "community" },
    );
    const b = await teachFact(
      { subject: "Xland", relation: "language", object: "Yish" },
      { source: "community" },
    );
    expect(a.kind).toBe("added");
    expect(b.kind).toBe("added");
  });

  it("disputes a conflicting functional fact and keeps the established value", async () => {
    await teachFact({ subject: "Wland", relation: "capital", object: "Way" }, { source: "community" });
    const r = await teachFact(
      { subject: "Wland", relation: "capital", object: "Wuy" },
      { source: "community" },
    );
    expect(r.kind).toBe("disputed");
    const active = await getStore().findActiveBySR("Wland", "capital");
    expect(active?.object).toBe("Way");
  });
});
