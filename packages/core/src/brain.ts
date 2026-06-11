/**
 * Brain: a high-level facade over the HDC primitives.
 *
 * It ties together an item memory of atomic symbols with the bind/bundle/
 * permute operations to provide the capabilities the demos need:
 *
 *  - Structured records and analogical reasoning ("the Dollar of Mexico").
 *  - One-shot / few-shot text classification (language, sentiment, ...).
 *  - Sequence memory (replay by position and next-element prediction).
 *
 * Everything is plain CPU math on typed arrays: no training loop, no GPU, no
 * external API. "Learning" is a single superposition step, which is why it is
 * instant and fully transparent.
 */

import {
  bind,
  bundle,
  cosineSimilarity,
  DIMENSIONS,
  type Hypervector,
  permute,
  seededHypervector,
} from "./hypervector";
import { type Match } from "./itemMemory";
import { encodeText, LetterCodebook } from "./encoders";

export interface BrainOptions {
  dimensions?: number;
  seed?: number;
  /** n-gram size used by the text encoder. */
  ngram?: number;
}

export interface SerializedBrain {
  dimensions: number;
  seed: number;
  ngram: number;
  atoms: Record<string, number[]>;
  records: Record<string, number[]>;
  classes: Record<string, number[]>;
  roleNames: string[];
  valueNames: string[];
}

export class Brain {
  readonly dimensions: number;
  readonly seed: number;
  readonly ngram: number;

  /** Atomic symbols: roles and values. */
  private atoms = new Map<string, Hypervector>();
  /** Composed structured records (e.g. one per country). */
  private records = new Map<string, Hypervector>();
  /** Class prototypes for text classification. */
  private classes = new Map<string, Hypervector>();

  private roleNames = new Set<string>();
  private valueNames = new Set<string>();

  private readonly codebook: LetterCodebook;

  constructor(options: BrainOptions = {}) {
    this.dimensions = options.dimensions ?? DIMENSIONS;
    this.seed = options.seed ?? 0;
    this.ngram = options.ngram ?? 3;
    this.codebook = new LetterCodebook(this.dimensions, this.seed);
  }

  // ---------------------------------------------------------------------------
  // Atomic symbols
  // ---------------------------------------------------------------------------

  /** Get an atomic symbol's vector, creating it deterministically if needed. */
  symbol(name: string): Hypervector {
    let v = this.atoms.get(name);
    if (!v) {
      v = seededHypervector(name, this.dimensions, this.seed);
      this.atoms.set(name, v);
    }
    return v;
  }

  hasSymbol(name: string): boolean {
    return this.atoms.has(name);
  }

  symbolNames(): string[] {
    return [...this.atoms.keys()];
  }

  // ---------------------------------------------------------------------------
  // Structured records and analogical reasoning
  // ---------------------------------------------------------------------------

  /**
   * Learn a record from named role/value fields. Each field becomes a bound
   * role/value pair, and all pairs are bundled into one holistic record vector.
   *
   * Example: learnRecord("USA", { capital: "Washington", currency: "Dollar" }).
   */
  learnRecord(name: string, fields: Record<string, string>): void {
    const pairs: Hypervector[] = [];
    for (const [role, value] of Object.entries(fields)) {
      this.roleNames.add(role);
      this.valueNames.add(value);
      pairs.push(bind(this.symbol(role), this.symbol(value)));
    }
    if (pairs.length === 0) {
      throw new Error(`Record "${name}" has no fields`);
    }
    this.records.set(name, bundle(pairs));
  }

  recordNames(): string[] {
    return [...this.records.keys()];
  }

  /**
   * Analogical query: "sourceValue is to sourceRecord as ??? is to targetRecord".
   *
   * It binds the two whole records together to obtain a mapping that swaps the
   * fillers of one record for the corresponding fillers of the other, then
   * applies that mapping to the source value. The result is cleaned up against
   * the known values. This is Kanerva's classic "What is the Dollar of Mexico?"
   * computed purely with vector algebra.
   */
  analogy(
    sourceRecord: string,
    targetRecord: string,
    sourceValue: string,
    k = 3,
  ): Match[] {
    const source = this.records.get(sourceRecord);
    const target = this.records.get(targetRecord);
    if (!source || !target) {
      throw new Error("Unknown record in analogy query");
    }
    const mapping = bind(source, target);
    const projected = bind(this.symbol(sourceValue), mapping);
    return this.cleanupValues(projected, k);
  }

  /** Rank the known values by similarity to a (possibly noisy) query vector. */
  cleanupValues(query: Hypervector, k = 1): Match[] {
    const matches: Match[] = [];
    for (const name of this.valueNames) {
      matches.push({ name, score: cosineSimilarity(query, this.symbol(name)) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  // ---------------------------------------------------------------------------
  // One-shot / few-shot text classification
  // ---------------------------------------------------------------------------

  /** Encode text into a hypervector using the shared letter codebook. */
  encode(text: string): Hypervector {
    return encodeText(text, this.codebook, {
      n: this.ngram,
      dimensions: this.dimensions,
    });
  }

  /**
   * Learn a class prototype from one or more example texts. Calling this again
   * for the same label merges the new examples with the existing prototype.
   */
  learnClass(label: string, examples: string[]): void {
    const vectors = examples
      .filter((t) => t.trim().length > 0)
      .map((t) => this.encode(t));
    if (vectors.length === 0) return;

    const existing = this.classes.get(label);
    if (existing) vectors.push(existing);
    this.classes.set(label, bundle(vectors));
  }

  classNames(): string[] {
    return [...this.classes.keys()];
  }

  /** Classify text by finding the nearest class prototype. */
  classify(text: string, k = 3): Match[] {
    const query = this.encode(text);
    const matches: Match[] = [];
    for (const [label, prototype] of this.classes) {
      matches.push({ name: label, score: cosineSimilarity(query, prototype) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  // ---------------------------------------------------------------------------
  // Sequence memory
  // ---------------------------------------------------------------------------

  /**
   * Encode an ordered sequence as a single hypervector by superimposing each
   * item permuted by its position. This supports recall by position (replay).
   */
  encodeSequence(items: string[]): Hypervector {
    if (items.length === 0) {
      throw new Error("Cannot encode an empty sequence");
    }
    return bundle(items.map((item, pos) => permute(this.symbol(item), pos)));
  }

  /** Recall the item stored at a given position of a sequence vector. */
  recallAt(sequence: Hypervector, position: number, k = 1): Match[] {
    const query = permute(sequence, -position);
    return this.cleanupSymbols(query, k);
  }

  /** Reconstruct (replay) a stored sequence of the given length. */
  replaySequence(sequence: Hypervector, length: number): string[] {
    const result: string[] = [];
    for (let pos = 0; pos < length; pos++) {
      const best = this.recallAt(sequence, pos, 1)[0];
      result.push(best?.name ?? "?");
    }
    return result;
  }

  /**
   * Build a transition memory from a sequence: a superposition of bindings
   * between each item and its (position-shifted) successor. Used to predict the
   * element that most likely follows a given item.
   */
  encodeTransitions(items: string[]): Hypervector {
    const pairs: Hypervector[] = [];
    for (let i = 0; i + 1 < items.length; i++) {
      pairs.push(
        bind(this.symbol(items[i]), permute(this.symbol(items[i + 1]), 1)),
      );
    }
    if (pairs.length === 0) {
      throw new Error("Need at least two items to learn transitions");
    }
    return bundle(pairs);
  }

  /** Predict the element most likely to follow `current` given transitions. */
  predictNext(transitions: Hypervector, current: string, k = 3): Match[] {
    const query = permute(bind(this.symbol(current), transitions), -1);
    return this.cleanupSymbols(query, k);
  }

  /** Rank all atomic symbols by similarity to a query vector. */
  cleanupSymbols(query: Hypervector, k = 1): Match[] {
    const matches: Match[] = [];
    for (const name of this.atoms.keys()) {
      matches.push({ name, score: cosineSimilarity(query, this.symbol(name)) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  toJSON(): SerializedBrain {
    const dump = (map: Map<string, Hypervector>) => {
      const out: Record<string, number[]> = {};
      for (const [name, v] of map) out[name] = Array.from(v);
      return out;
    };
    return {
      dimensions: this.dimensions,
      seed: this.seed,
      ngram: this.ngram,
      atoms: dump(this.atoms),
      records: dump(this.records),
      classes: dump(this.classes),
      roleNames: [...this.roleNames],
      valueNames: [...this.valueNames],
    };
  }

  static fromJSON(data: SerializedBrain): Brain {
    const brain = new Brain({
      dimensions: data.dimensions,
      seed: data.seed,
      ngram: data.ngram,
    });
    const load = (
      target: Map<string, Hypervector>,
      source: Record<string, number[]>,
    ) => {
      for (const [name, values] of Object.entries(source)) {
        target.set(name, Int8Array.from(values));
      }
    };
    load(brain.atoms, data.atoms);
    load(brain.records, data.records);
    load(brain.classes, data.classes);
    brain.roleNames = new Set(data.roleNames);
    brain.valueNames = new Set(data.valueNames);
    return brain;
  }
}
