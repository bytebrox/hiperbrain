/**
 * Text encoder for HDC.
 *
 * Turns a string into a single hypervector using the classic character n-gram
 * scheme (Rahimi et al., "A Robust and Energy-Efficient Classifier Using
 * Brain-Inspired Hyperdimensional Computing"):
 *
 *  1. Every character maps to a fixed random "letter" hypervector.
 *  2. Each n-gram is encoded by binding its letters together, using permutation
 *     to encode the position of each letter within the n-gram. This makes
 *     "abc" different from "cba".
 *  3. All n-gram vectors of the text are bundled (superimposed) into one vector.
 *
 * The resulting vector is a holistic fingerprint of the text's n-gram
 * statistics. Texts in the same language (or of the same class) end up close
 * together in hyperdimensional space, which is what makes one-shot
 * classification work.
 */

import {
  bind,
  DIMENSIONS,
  finalizeAccumulator,
  type Hypervector,
  permute,
  seededHypervector,
} from "./hypervector";

export interface TextEncoderOptions {
  /** Size of the character n-grams. 3 (trigrams) is a robust default. */
  n?: number;
  dimensions?: number;
  /** Seed offset so letter codebooks can be varied independently. */
  seed?: number;
}

/**
 * A reusable codebook mapping characters to deterministic hypervectors.
 * Sharing one codebook across all texts is essential: comparisons are only
 * meaningful when every text is built from the same atomic letter vectors.
 */
export class LetterCodebook {
  private cache = new Map<string, Hypervector>();

  constructor(
    private readonly dimensions = DIMENSIONS,
    private readonly seed = 0,
  ) {}

  vectorFor(char: string): Hypervector {
    let v = this.cache.get(char);
    if (!v) {
      v = seededHypervector(`char:${char}`, this.dimensions, this.seed);
      this.cache.set(char, v);
    }
    return v;
  }
}

/** Encode a single n-gram by binding position-permuted letter vectors. */
function encodeNgram(gram: string, codebook: LetterCodebook): Hypervector {
  let acc: Hypervector | null = null;
  for (let pos = 0; pos < gram.length; pos++) {
    // Permuting by the letter's position encodes order within the n-gram.
    const letter = permute(codebook.vectorFor(gram[pos]), pos);
    acc = acc === null ? letter : bind(acc, letter);
  }
  // `acc` is non-null because callers always pass a non-empty gram.
  return acc as Hypervector;
}

/**
 * Encode arbitrary text into a single bipolar hypervector. Text is lowercased
 * so that casing does not fragment the n-gram statistics.
 */
export function encodeText(
  text: string,
  codebook: LetterCodebook,
  options: TextEncoderOptions = {},
): Hypervector {
  const { n = 3, dimensions = DIMENSIONS } = options;
  const normalized = text.toLowerCase().trim();

  const acc = new Int32Array(dimensions);
  let count = 0;

  if (normalized.length < n) {
    // Too short for a full n-gram: fall back to encoding each character.
    for (const char of normalized) {
      const v = codebook.vectorFor(char);
      for (let i = 0; i < dimensions; i++) acc[i] += v[i];
      count++;
    }
  } else {
    for (let i = 0; i + n <= normalized.length; i++) {
      const gram = encodeNgram(normalized.slice(i, i + n), codebook);
      for (let j = 0; j < dimensions; j++) acc[j] += gram[j];
      count++;
    }
  }

  if (count === 0) {
    // Empty input: return a neutral (all +1) vector rather than throwing.
    return new Int8Array(dimensions).fill(1);
  }
  return finalizeAccumulator(acc);
}
