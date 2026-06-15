import { describe, expect, it } from "vitest";
import { canonicalRelation, VERB_RELATIONS } from "./relation-aliases";

describe("canonicalRelation", () => {
  it("maps everyday synonyms to the canonical relation", () => {
    expect(canonicalRelation("money")).toBe("currency");
    expect(canonicalRelation("capital city")).toBe("capital");
    expect(canonicalRelation("antonym")).toBe("opposite");
    expect(canonicalRelation("colour")).toBe("color");
    expect(canonicalRelation("chief executive")).toBe("ceo");
    expect(canonicalRelation("max speed")).toBe("top speed");
  });

  it("normalises case and whitespace", () => {
    expect(canonicalRelation("  Capital  City ")).toBe("capital");
    expect(canonicalRelation("MONEY")).toBe("currency");
  });

  it("leaves an unknown relation untouched (lowercased)", () => {
    expect(canonicalRelation("Capital")).toBe("capital");
    expect(canonicalRelation("population")).toBe("population");
  });

  it("does not collapse multi-valued relations like language", () => {
    expect(canonicalRelation("language")).toBe("language");
  });

  it("exposes verb-to-relation mappings", () => {
    expect(VERB_RELATIONS.leads).toBe("ceo");
    expect(VERB_RELATIONS.founded).toBe("founder");
    expect(VERB_RELATIONS.wrote).toBe("author");
  });
});
