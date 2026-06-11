/**
 * KnowledgeBrain: a collective, holographic associative memory.
 *
 * Every fact is a (subject, relation, object) triple. Facts are grouped by
 * relation, and each relation keeps ONE bundled memory vector that superimposes
 * the bindings of its subject/object pairs:
 *
 *     M[relation] = bundle_i ( subject_i ⊗ object_i )
 *
 * Because binding is its own inverse, a question is answered by binding the
 * known part back into the relation's memory and cleaning up the result:
 *
 *     object  ≈ cleanup( subject ⊗ M[relation] )
 *     subject ≈ cleanup( object  ⊗ M[relation] )
 *
 * This is why a collective brain is natural in HDC: contributions are additive
 * and order-independent, so any number of visitors can fold facts into the same
 * memory without coordination. Bucketing by relation keeps each memory focused,
 * which raises capacity and recall accuracy. As a bucket fills up, recall
 * degrades gracefully - the capacity-limited behaviour of real associative
 * memory.
 */

import {
  accumulate,
  bind,
  cosineSimilarity,
  DIMENSIONS,
  finalizeAccumulator,
  type Hypervector,
  seededHypervector,
} from "./hypervector";
import { type Match } from "./itemMemory";

export interface Fact {
  subject: string;
  relation: string;
  object: string;
}

export interface BrainStats {
  facts: number;
  concepts: number;
  relations: number;
}

interface RelationBucket {
  acc: Int32Array;
  memo: Hypervector | null;
  subjects: Set<string>;
  objects: Set<string>;
}

export class KnowledgeBrain {
  readonly dimensions: number;
  readonly seed: number;

  private buckets = new Map<string, RelationBucket>();
  private symbolCache = new Map<string, Hypervector>();
  private concepts = new Set<string>();
  private factCount = 0;

  // Per-entity "records": for every subject we superimpose its
  // (relation ⊗ object) pairs into one holographic record vector. This is what
  // makes analogical reasoning possible (see `analogy`).
  private recordAcc = new Map<string, Int32Array>();
  private recordMemo = new Map<string, Hypervector>();
  private objects = new Set<string>();

  constructor(dimensions = DIMENSIONS, seed = 0) {
    this.dimensions = dimensions;
    this.seed = seed;
  }

  /** Build a brain by folding in an existing list of facts. */
  static fromFacts(facts: Fact[], dimensions = DIMENSIONS, seed = 0): KnowledgeBrain {
    const brain = new KnowledgeBrain(dimensions, seed);
    for (const fact of facts) brain.learn(fact);
    return brain;
  }

  private symbol(name: string): Hypervector {
    let v = this.symbolCache.get(name);
    if (!v) {
      v = seededHypervector(name, this.dimensions, this.seed);
      this.symbolCache.set(name, v);
    }
    return v;
  }

  private bucket(relation: string): RelationBucket {
    let b = this.buckets.get(relation);
    if (!b) {
      b = {
        acc: new Int32Array(this.dimensions),
        memo: null,
        subjects: new Set(),
        objects: new Set(),
      };
      this.buckets.set(relation, b);
    }
    return b;
  }

  /** Fold a single fact into the collective memory. */
  learn({ subject, relation, object }: Fact): void {
    const bucket = this.bucket(relation);
    accumulate(bucket.acc, bind(this.symbol(subject), this.symbol(object)));
    bucket.memo = null;
    bucket.subjects.add(subject);
    bucket.objects.add(object);
    this.concepts.add(subject);
    this.concepts.add(object);
    this.objects.add(object);

    // Fold (relation ⊗ object) into the subject's holographic record.
    let acc = this.recordAcc.get(subject);
    if (!acc) {
      acc = new Int32Array(this.dimensions);
      this.recordAcc.set(subject, acc);
    }
    accumulate(acc, bind(this.symbol(relation), this.symbol(object)));
    this.recordMemo.delete(subject);

    this.factCount++;
  }

  /** The bundled record vector for an entity, or null if unknown. */
  private record(entity: string): Hypervector | null {
    let memo = this.recordMemo.get(entity);
    if (memo) return memo;
    const acc = this.recordAcc.get(entity);
    if (!acc) return null;
    memo = finalizeAccumulator(acc);
    this.recordMemo.set(entity, memo);
    return memo;
  }

  private memory(bucket: RelationBucket): Hypervector {
    if (!bucket.memo) bucket.memo = finalizeAccumulator(bucket.acc);
    return bucket.memo;
  }

  private cleanup(query: Hypervector, names: Iterable<string>, k: number): Match[] {
    const matches: Match[] = [];
    for (const name of names) {
      matches.push({ name, score: cosineSimilarity(query, this.symbol(name)) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  /** Answer "what is the <relation> of <subject>?" */
  ask(subject: string, relation: string, k = 5): Match[] {
    const bucket = this.buckets.get(relation);
    if (!bucket) return [];
    const query = bind(this.symbol(subject), this.memory(bucket));
    const candidates = [...bucket.objects].filter((c) => c !== subject);
    return this.cleanup(query, candidates, k);
  }

  /** Answer the reverse question: "what is the <relation> for <object>?" */
  askSubject(relation: string, object: string, k = 5): Match[] {
    const bucket = this.buckets.get(relation);
    if (!bucket) return [];
    const query = bind(this.symbol(object), this.memory(bucket));
    const candidates = [...bucket.subjects].filter((c) => c !== object);
    return this.cleanup(query, candidates, k);
  }

  /**
   * Analogical reasoning - the classic "What is the Dollar of Mexico?" trick.
   *
   * Given that `value` is a filler of entity `from` (e.g. Dollar is the currency
   * of the USA), this finds the corresponding filler of entity `to` (the
   * currency of Mexico = Peso) WITHOUT being told which relation connects them.
   *
   * The mapping `from ⊗ to` swaps each entity's fillers for the other's:
   *
   *     value ⊗ (record(from) ⊗ record(to))  ≈  the matching filler of `to`
   *
   * because `value ⊗ record(from)` recovers the *role* (e.g. currency), and
   * binding that role into `record(to)` recovers `to`'s filler for it. The
   * answer falls straight out of the algebra - no rules, no lookup table.
   *
   * Reads naturally as: "`from` is to `value` as `to` is to ___ ?"
   */
  analogy(value: string, from: string, to: string, k = 5): Match[] {
    const recFrom = this.record(from);
    const recTo = this.record(to);
    if (!recFrom || !recTo) return [];

    const mapping = bind(recFrom, recTo);
    const query = bind(this.symbol(value), mapping);

    const exclude = new Set([value, from, to]);
    const candidates = [...this.objects].filter((c) => !exclude.has(c));
    return this.cleanup(query, candidates, k);
  }

  /** Every value that has appeared as an object, sorted. */
  knownObjects(): string[] {
    return [...this.objects].sort();
  }

  knownConcepts(): string[] {
    return [...this.concepts].sort();
  }

  knownRelations(): string[] {
    return [...this.buckets.keys()].sort();
  }

  stats(): BrainStats {
    return {
      facts: this.factCount,
      concepts: this.concepts.size,
      relations: this.buckets.size,
    };
  }

  /**
   * A representative "thought" vector for visualisation: the bundle of every
   * relation memory. Purely for display - not used for recall.
   */
  thoughtVector(): Hypervector {
    const acc = new Int32Array(this.dimensions);
    for (const bucket of this.buckets.values()) {
      accumulate(acc, this.memory(bucket));
    }
    return finalizeAccumulator(acc);
  }
}
