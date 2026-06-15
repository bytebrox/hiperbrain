import { describe, expect, it } from "vitest";
import { parseCommand } from "./parse-command";

describe("parseCommand", () => {
  it("treats blank input as empty", () => {
    expect(parseCommand("   ").kind).toBe("empty");
  });

  describe("ask", () => {
    it("parses the canonical form", () => {
      expect(parseCommand("capital of France")).toEqual({
        kind: "ask",
        relation: "capital",
        subject: "France",
      });
    });

    it("ignores a question mark", () => {
      expect(parseCommand("capital of France?")).toMatchObject({ kind: "ask" });
    });

    it("strips question framing and articles", () => {
      for (const q of [
        "What is the capital of France?",
        "what's the capital of France",
        "tell me the capital of France",
        "Where is the capital of France?",
      ]) {
        expect(parseCommand(q)).toEqual({
          kind: "ask",
          relation: "capital",
          subject: "France",
        });
      }
    });

    it("understands possessive phrasing", () => {
      expect(parseCommand("France's capital")).toEqual({
        kind: "ask",
        relation: "capital",
        subject: "France",
      });
    });
  });

  describe("teach", () => {
    it("parses the canonical form", () => {
      expect(parseCommand("capital of Spain is Madrid")).toEqual({
        kind: "teach",
        subject: "Spain",
        relation: "capital",
        object: "Madrid",
      });
    });

    it("parses the reversed natural form", () => {
      expect(parseCommand("Madrid is the capital of Spain")).toEqual({
        kind: "teach",
        subject: "Spain",
        relation: "capital",
        object: "Madrid",
      });
    });

    it("parses possessive statements", () => {
      expect(parseCommand("Spain's capital is Madrid")).toEqual({
        kind: "teach",
        subject: "Spain",
        relation: "capital",
        object: "Madrid",
      });
    });

    it("accepts an = separator", () => {
      expect(parseCommand("capital of Spain = Madrid")).toEqual({
        kind: "teach",
        subject: "Spain",
        relation: "capital",
        object: "Madrid",
      });
    });
  });

  describe("analogy", () => {
    it("parses the full form", () => {
      expect(parseCommand("USA is to Dollar as Mexico is to ?")).toEqual({
        kind: "analogy",
        from: "USA",
        value: "Dollar",
        to: "Mexico",
      });
    });

    it("does not confuse a reversed teach for an analogy", () => {
      expect(parseCommand("Paris is the capital of France")).toMatchObject({
        kind: "teach",
        subject: "France",
      });
    });
  });

  describe("verb questions", () => {
    it("maps 'who leads X' to the ceo relation", () => {
      expect(parseCommand("who leads Tesla?")).toEqual({
        kind: "ask",
        subject: "Tesla",
        relation: "ceo",
      });
    });

    it("maps 'who founded X' and 'who wrote X'", () => {
      expect(parseCommand("who founded Apple")).toMatchObject({
        kind: "ask",
        relation: "founder",
        subject: "Apple",
      });
      expect(parseCommand("who wrote the Odyssey")).toMatchObject({
        kind: "ask",
        relation: "author",
        subject: "Odyssey",
      });
    });

    it("still defers 'who is the ...' to normal question handling", () => {
      expect(parseCommand("who is the president of France")).toEqual({
        kind: "ask",
        relation: "president",
        subject: "France",
      });
    });

    it("does not hijack an unknown verb", () => {
      expect(parseCommand("who likes pizza").kind).toBe("invalid");
    });
  });

  it("falls back to a helpful hint", () => {
    expect(parseCommand("hello there").kind).toBe("invalid");
  });
});
