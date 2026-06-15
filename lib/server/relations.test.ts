import { describe, expect, it } from "vitest";
import { isFunctional } from "./relations";

describe("isFunctional", () => {
  it("treats curated single-valued relations as functional", () => {
    expect(isFunctional("capital")).toBe(true);
    expect(isFunctional("currency")).toBe(true);
    expect(isFunctional("color")).toBe(true);
    expect(isFunctional("author")).toBe(true);
  });

  it("normalises case and surrounding whitespace", () => {
    expect(isFunctional("Capital")).toBe(true);
    expect(isFunctional("  CURRENCY  ")).toBe(true);
    expect(isFunctional("atomic   number")).toBe(true);
  });

  it("treats anything not curated as multi-valued", () => {
    expect(isFunctional("language")).toBe(false);
    expect(isFunctional("neighbor")).toBe(false);
    expect(isFunctional("friend")).toBe(false);
    expect(isFunctional("member")).toBe(false);
  });
});
