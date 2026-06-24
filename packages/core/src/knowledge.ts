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
  DIMENSIONS,
  finalizeAccumulator,
  type Hypervector,
  packedTieSigns,
  seededPackedHypervector,
} from "./hypervector";
import {
  bindPacked,
  packBits,
  similarityPacked,
  unpackBits,
  type PackedHypervector,
} from "./bitpack";

/**
 * Accumulate `bind(a, b)` (element-wise sign product) into `acc` working
 * directly in the bit-packed domain: for bipolar vectors the product's sign is
 * the XOR of the two sign-bits (`+1 -> 0`, `-1 -> 1`). This avoids unpacking two
 * ~10 KB dense vectors and allocating a third on every fact, which is the
 * difference between a brain that builds in seconds and one that takes minutes.
 */
function accumulateBindPacked(acc: Int32Array, a: PackedHypervector, b: PackedHypervector): void {
  const dim = acc.length;
  for (let i = 0; i < dim; i++) {
    acc[i] += ((a[i >>> 5] ^ b[i >>> 5]) >>> (i & 31)) & 1 ? -1 : 1;
  }
}
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
  /** Number of facts folded into this relation (its bundle load). */
  count: number;
}

/**
 * A calibrated read on how trustworthy a recall is. The cosine of two random
 * bipolar vectors has standard deviation ~1/sqrt(D), so we express the top score
 * in "noise sigmas" (`z`) and the gap to the runner-up as a margin. A result is
 * only `confident` when it is both far above chance and clearly ahead of the
 * next candidate.
 */
export interface Confidence {
  /** Display value in [0, 1]. */
  score: number;
  /** Whether the recall is strong and unambiguous. */
  confident: boolean;
  /** Top score expressed in units of noise standard deviation. */
  sigma: number;
}

/** Derive calibrated confidence from a ranked list of matches. */
export function recallConfidence(matches: Match[], dimensions = DIMENSIONS): Confidence {
  if (matches.length === 0) return { score: 0, confident: false, sigma: 0 };
  const noise = 1 / Math.sqrt(dimensions);
  const top = matches[0].score;
  const second = matches[1]?.score ?? 0;
  const sigma = top / noise;
  const marginSigma = (top - second) / noise;
  const confident = sigma >= 4 && marginSigma >= 2;
  const score = Math.max(0, Math.min(1, (sigma - 2) / 10));
  return { score, confident, sigma };
}

export class KnowledgeBrain {
  readonly dimensions: number;
  readonly seed: number;

  private buckets = new Map<string, RelationBucket>();
  // Symbols are cached ONLY in their bit-packed form (~1.25 KB each instead of a
  // ~10 KB dense Int8Array). The dense vector is reconstructed on demand via
  // `unpackBits` for the few operations that need it. This keeps a brain with
  // hundreds of thousands of concepts inside a few hundred MB instead of GBs.
  private packedCache = new Map<string, PackedHypervector>();
  private concepts = new Set<string>();
  private factCount = 0;

  // Per-entity "records": for every subject we superimpose its
  // (relation ⊗ object) pairs into one holographic record vector. This is what
  // makes analogical reasoning possible (see `analogy`). Rather than keeping a
  // dense Int32 accumulator per subject (40 KB each — fatal at scale), we store
  // just the subject's (relation, object) pairs and rebuild its record on
  // demand. The bit-packed record is cached for the neighbour search.
  private recordFacts = new Map<string, { relation: string; object: string }[]>();
  private packedRecordCache = new Map<string, PackedHypervector>();
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

  /**
   * The dense bipolar symbol for a name. Reconstructed by unpacking the cached
   * packed form, so each concept's vector is generated (and stored) only once,
   * compactly. `unpackBits(packBits(v)) === v` for bipolar vectors, so this is
   * byte-identical to the original deterministic symbol.
   */
  private symbol(name: string): Hypervector {
    return unpackBits(this.packedSymbol(name), this.dimensions);
  }

  /** Bit-packed form of a symbol, cached — the only persistent per-concept store. */
  private packedSymbol(name: string): PackedHypervector {
    let p = this.packedCache.get(name);
    if (!p) {
      p = seededPackedHypervector(name, this.dimensions, this.seed);
      this.packedCache.set(name, p);
    }
    return p;
  }

  private bucket(relation: string): RelationBucket {
    let b = this.buckets.get(relation);
    if (!b) {
      b = {
        acc: new Int32Array(this.dimensions),
        memo: null,
        subjects: new Set(),
        objects: new Set(),
        count: 0,
      };
      this.buckets.set(relation, b);
    }
    return b;
  }

  /** Fold a single fact into the collective memory. */
  learn({ subject, relation, object }: Fact): void {
    const bucket = this.bucket(relation);
    accumulateBindPacked(bucket.acc, this.packedSymbol(subject), this.packedSymbol(object));
    bucket.memo = null;
    bucket.count++;
    bucket.subjects.add(subject);
    bucket.objects.add(object);
    this.concepts.add(subject);
    this.concepts.add(object);
    this.objects.add(object);

    // Remember the (relation, object) pair so the subject's holographic record
    // can be rebuilt on demand (see `record`). No dense accumulator is kept.
    let pairs = this.recordFacts.get(subject);
    if (!pairs) {
      pairs = [];
      this.recordFacts.set(subject, pairs);
    }
    pairs.push({ relation, object });
    this.packedRecordCache.delete(subject);

    this.factCount++;
  }

  /**
   * The bundled record vector for an entity, or null if unknown. Rebuilt on
   * demand from the entity's (relation ⊗ object) pairs. Bundling is commutative,
   * so the result is independent of insertion order and identical to a running
   * accumulator.
   */
  private record(entity: string): Hypervector | null {
    const pairs = this.recordFacts.get(entity);
    if (!pairs || pairs.length === 0) return null;
    // A single pair needs no majority vote: the sign of one ±1 vector is itself,
    // so the record is just bind(relation, object) — computed as a packed XOR.
    if (pairs.length === 1) {
      const { relation, object } = pairs[0];
      return unpackBits(
        bindPacked(this.packedSymbol(relation), this.packedSymbol(object)),
        this.dimensions,
      );
    }
    const acc = new Int32Array(this.dimensions);
    for (const { relation, object } of pairs) {
      accumulateBindPacked(acc, this.packedSymbol(relation), this.packedSymbol(object));
    }
    return finalizeAccumulator(acc);
  }

  /**
   * Bit-packed form of an entity's record, cached for the neighbour search.
   * `packBits` is deterministic, so the cached vector is byte-identical to a
   * fresh pack; the cache is cleared in `learn()` when the record changes.
   */
  private packedRecord(entity: string): PackedHypervector | null {
    let p = this.packedRecordCache.get(entity);
    if (p) return p;
    const pairs = this.recordFacts.get(entity);
    if (!pairs || pairs.length === 0) return null;
    // Single-pair records (the long tail of an open-world brain) are a plain XOR
    // of two packed symbols — no dense intermediate, no majority vote. This is
    // what keeps `similarConcepts` fast even across 100k+ entities.
    if (pairs.length === 1) {
      const { relation, object } = pairs[0];
      p = bindPacked(this.packedSymbol(relation), this.packedSymbol(object));
    } else if (pairs.length === 2) {
      // Majority of two: where the bound pairs agree, keep that sign; where they
      // disagree (an exact tie), fall back to the deterministic tie-sign. All in
      // packed words — no dense ~10 KB accumulator. This is the common case for
      // entities with a couple of facts and keeps `similarConcepts` fast.
      const a = bindPacked(this.packedSymbol(pairs[0].relation), this.packedSymbol(pairs[0].object));
      const b = bindPacked(this.packedSymbol(pairs[1].relation), this.packedSymbol(pairs[1].object));
      const tie = packedTieSigns(this.dimensions);
      p = new Uint32Array(a.length);
      for (let w = 0; w < a.length; w++) {
        const diff = a[w] ^ b[w];
        p[w] = (a[w] & ~diff) | (tie[w] & diff);
      }
    } else {
      const acc = new Int32Array(this.dimensions);
      for (const { relation, object } of pairs) {
        accumulateBindPacked(acc, this.packedSymbol(relation), this.packedSymbol(object));
      }
      p = packBits(finalizeAccumulator(acc));
    }
    this.packedRecordCache.set(entity, p);
    return p;
  }

  private memory(bucket: RelationBucket): Hypervector {
    if (!bucket.memo) bucket.memo = finalizeAccumulator(bucket.acc);
    return bucket.memo;
  }

  /**
   * Rank candidate symbols by similarity to a noisy query and return the top k.
   * Uses the bit-packed XOR/popcount path, which yields the same cosine ranking
   * as the bipolar form but runs far faster over large candidate sets.
   */
  private cleanup(
    query: Hypervector,
    names: Iterable<string>,
    k: number,
    exclude?: string | ReadonlySet<string>,
  ): Match[] {
    const q = packBits(query);
    const matches: Match[] = [];
    for (const name of names) {
      if (exclude !== undefined) {
        if (typeof exclude === "string") {
          if (name === exclude) continue;
        } else if (exclude.has(name)) {
          continue;
        }
      }
      matches.push({
        name,
        score: similarityPacked(q, this.packedSymbol(name), this.dimensions),
      });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  /**
   * Answer "what is the <relation> of <subject>?"
   *
   * Two recall paths, strongest wins:
   *
   *  1. Per-subject record (preferred). The object is recovered from the
   *     subject's own holographic record via `record(subject) ⊗ relation`. Its
   *     bundle load is only the number of facts about THIS subject (usually a
   *     handful), so recall stays sharp no matter how many facts share the
   *     relation across the whole brain. This is what keeps "currency of France"
   *     answerable even when the brain knows thousands of currencies.
   *  2. Relation bundle (fallback). The original `subject ⊗ relationMemory`
   *     path, for subjects we have no record for or when it happens to be
   *     stronger.
   */
  ask(subject: string, relation: string, k = 5): Match[] {
    const bucket = this.buckets.get(relation);
    if (!bucket) return [];
    // Candidates are every object of this relation except the subject itself.
    // Iterate the Set directly (excluding `subject`) instead of materialising a
    // filtered array on every recall.
    const candidateCount = bucket.objects.size - (bucket.objects.has(subject) ? 1 : 0);
    if (candidateCount === 0) return [];

    const rec = this.record(subject);
    const viaRecord = rec
      ? this.cleanup(bind(rec, this.symbol(relation)), bucket.objects, k, subject)
      : null;
    // Fast path: a confident hit from the subject's record needs nothing more.
    if (viaRecord && recallConfidence(viaRecord, this.dimensions).confident) {
      return viaRecord;
    }

    const viaBucket = this.cleanup(
      bind(this.symbol(subject), this.memory(bucket)),
      bucket.objects,
      k,
      subject,
    );
    if (!viaRecord) return viaBucket;

    // Otherwise keep whichever path has the stronger signal, so we never do
    // worse than the original relation-bundle recall.
    const sRecord = recallConfidence(viaRecord, this.dimensions).sigma;
    const sBucket = recallConfidence(viaBucket, this.dimensions).sigma;
    return sRecord >= sBucket ? viaRecord : viaBucket;
  }

  /** Answer the reverse question: "what is the <relation> for <object>?" */
  askSubject(relation: string, object: string, k = 5): Match[] {
    const bucket = this.buckets.get(relation);
    if (!bucket) return [];
    const query = bind(this.symbol(object), this.memory(bucket));
    return this.cleanup(query, bucket.subjects, k, object);
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
    return this.cleanup(query, this.objects, k, exclude);
  }

  /**
   * Recover the *relation* that connects `value` to entity `entity` - the role
   * that the analogy machinery uses internally. `value ⊗ record(entity)`
   * isolates the role vector, which we clean up against the known relations.
   *
   * This is what makes the analogy explainable: it shows that asking "Dollar is
   * to USA as ___ is to Mexico" first deduces the relation ("currency") purely
   * by algebra, with no rules and no lookup table.
   */
  recoverRelation(value: string, entity: string, k = 3): Match[] {
    const rec = this.record(entity);
    if (!rec) return [];
    const query = bind(this.symbol(value), rec);
    return this.cleanup(query, this.buckets.keys(), k);
  }

  /**
   * Find entities whose holographic record is most similar to `entity`'s -
   * "concepts like France". Because each record superimposes an entity's
   * (relation ⊗ object) pairs, entities that share fillers (same currency,
   * same continent, ...) end up close together with no explicit clustering step.
   */
  similarConcepts(entity: string, k = 5): Match[] {
    const q = this.packedRecord(entity);
    if (!q) return [];
    const matches: Match[] = [];
    for (const other of this.recordFacts.keys()) {
      if (other === entity) continue;
      const orec = this.packedRecord(other);
      if (!orec) continue;
      matches.push({ name: other, score: similarityPacked(q, orec, this.dimensions) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  /** The bundle load (number of facts folded) of a relation, or 0 if unknown. */
  relationSize(relation: string): number {
    return this.buckets.get(relation)?.count ?? 0;
  }

  /** Every value that has appeared as an object, sorted. */
  knownObjects(): string[] {
    return [...this.objects].sort();
  }

  /** Every entity that has a holographic record (i.e. has appeared as a subject). */
  knownSubjects(): string[] {
    return [...this.recordFacts.keys()].sort();
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
