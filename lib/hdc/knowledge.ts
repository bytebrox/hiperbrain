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
    this.factCount++;
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
