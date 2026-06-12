/**
 * ConceptResolver: typo-tolerant lookup of known names.
 *
 * The engine itself is fault-tolerant, but plain string matching is not - a user
 * who types "Frnace" or "captial" gets nothing. This resolver encodes every
 * known name into a character n-gram hypervector (the same robust text encoding
 * used for classification) and finds the closest known name by similarity, so
 * small misspellings still land on the right concept. It is the brain's
 * fault tolerance applied to the *input*, not just the recall.
 */

import {
  bind,
  DIMENSIONS,
  finalizeAccumulator,
  type Hypervector,
  permute,
} from "./hypervector";
import { LetterCodebook } from "./encoders";
import { packBits, similarityPacked, type PackedHypervector } from "./bitpack";

export interface ResolveMatch {
  name: string;
  /** Similarity in [-1, 1]; 1 means an exact (case-insensitive) match. */
  score: number;
}

export interface ConceptResolverOptions {
  dimensions?: number;
  seed?: number;
  /**
   * n-gram sizes blended into the fingerprint. Defaults to [1, 2, 3]: the
   * unigram (bag-of-characters) component makes matching robust to letter
   * transpositions ("Frnace" -> "France"), while the bi-/tri-grams keep it
   * order-sensitive enough to separate genuinely different words.
   */
  ngrams?: number[];
}

export class ConceptResolver {
  readonly dimensions: number;
  private readonly ngrams: number[];
  private readonly codebook: LetterCodebook;
  private packed = new Map<string, PackedHypervector>();

  constructor(names: Iterable<string> = [], options: ConceptResolverOptions = {}) {
    this.dimensions = options.dimensions ?? DIMENSIONS;
    this.ngrams = options.ngrams ?? [1, 2, 3];
    this.codebook = new LetterCodebook(this.dimensions, options.seed ?? 0);
    for (const name of names) this.add(name);
  }

  /** Encode one n-gram by binding its position-permuted letter vectors. */
  private gram(g: string): Hypervector {
    let acc: Hypervector | null = null;
    for (let p = 0; p < g.length; p++) {
      const letter = permute(this.codebook.vectorFor(g[p]), p);
      acc = acc === null ? letter : bind(acc, letter);
    }
    return acc as Hypervector;
  }

  /**
   * Multi-resolution fingerprint: every n-gram (for each configured n) is summed
   * into a single accumulator before thresholding. For short names the numerous
   * unigrams dominate, so a transposition leaves most of the signal intact while
   * the longer grams still encode order.
   */
  private encode(text: string): PackedHypervector {
    const norm = text.toLowerCase().trim();
    const acc = new Int32Array(this.dimensions);
    for (const n of this.ngrams) {
      const limit = norm.length - n;
      if (limit < 0) {
        for (const ch of norm) {
          const v = this.codebook.vectorFor(ch);
          for (let i = 0; i < this.dimensions; i++) acc[i] += v[i];
        }
        continue;
      }
      for (let i = 0; i <= limit; i++) {
        const gv = this.gram(norm.slice(i, i + n));
        for (let j = 0; j < this.dimensions; j++) acc[j] += gv[j];
      }
    }
    return packBits(finalizeAccumulator(acc));
  }

  /** Index a name so it can be matched against. */
  add(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || this.packed.has(trimmed)) return;
    this.packed.set(trimmed, this.encode(trimmed));
  }

  get size(): number {
    return this.packed.size;
  }

  /** Top-k known names ranked by similarity to the (possibly misspelled) query. */
  nearest(query: string, k = 3): ResolveMatch[] {
    const q = this.encode(query);
    const matches: ResolveMatch[] = [];
    for (const [name, vec] of this.packed) {
      matches.push({ name, score: similarityPacked(q, vec, this.dimensions) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  /**
   * Resolve a query to a known name. Exact (case-insensitive) hits win outright;
   * otherwise the nearest name is returned only if it both clears `minScore` and
   * stands clearly ahead of the runner-up. The margin test is what rejects
   * genuinely unknown input, whose nearest hit is weak and ambiguous, regardless
   * of how many concepts are indexed.
   */
  resolve(query: string, minScore = 0.3): ResolveMatch | null {
    const trimmed = query.trim();
    if (!trimmed) return null;
    for (const name of this.packed.keys()) {
      if (name.toLowerCase() === trimmed.toLowerCase()) return { name, score: 1 };
    }
    const top = this.nearest(trimmed, 2);
    const best = top[0];
    if (!best || best.score < minScore) return null;
    const second = top[1]?.score ?? 0;
    if (best.score < second + 0.1) return null;
    return best;
  }
}
