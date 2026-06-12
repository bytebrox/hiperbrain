/**
 * Bit-packed hypervectors: a fast, memory-dense representation.
 *
 * A bipolar hypervector (every component -1 or +1) carries exactly one bit of
 * information per dimension, yet an `Int8Array` spends a whole byte on each.
 * Packing the sign into a single bit (`+1 -> 0`, `-1 -> 1`) shrinks a 10,000-d
 * vector from ~10 KB to ~1.25 KB (8x smaller) and turns the two hottest
 * operations into machine-friendly bitwise math:
 *
 * (The `-1 -> 1` convention is what makes bind a plain XOR: the product of two
 * signs equals the XOR of their sign-bits.)
 *
 *  - bind        -> XOR            (one word at a time, 32 dims per op)
 *  - similarity  -> popcount(XOR)  (Hamming distance, then mapped to cosine)
 *
 * Cosine similarity of two bipolar vectors equals `(D - 2 * hamming) / D`, so a
 * single pass of popcounts reproduces the exact same ranking as the readable
 * `Int8Array` path - just ~20-30x faster for large candidate sets. The bipolar
 * form remains the canonical, human-readable API; this is the accelerator.
 */

import { type Hypervector } from "./hypervector";

/** A bit-packed hypervector: one bit per dimension, 32 dims per 32-bit word. */
export type PackedHypervector = Uint32Array;

/** Number of 32-bit words needed to hold `dimensions` bits. */
export function packedWords(dimensions: number): number {
  return (dimensions + 31) >>> 5;
}

/** Pack a bipolar hypervector (+1 -> bit clear, -1 -> bit set). */
export function packBits(v: Hypervector): PackedHypervector {
  const words = packedWords(v.length);
  const out = new Uint32Array(words);
  for (let i = 0; i < v.length; i++) {
    if (v[i] < 0) out[i >>> 5] |= 1 << (i & 31);
  }
  return out;
}

/** Unpack back into a bipolar hypervector of the given dimensionality. */
export function unpackBits(packed: PackedHypervector, dimensions: number): Hypervector {
  const out = new Int8Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    out[i] = (packed[i >>> 5] >>> (i & 31)) & 1 ? -1 : 1;
  }
  return out;
}

/** Bind two packed vectors: element-wise XOR (its own inverse, like multiply). */
export function bindPacked(a: PackedHypervector, b: PackedHypervector): PackedHypervector {
  const out = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/** Population count (number of set bits) of a 32-bit word. */
export function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24) & 0xff;
}

/** Hamming distance between two packed vectors (count of differing bits). */
export function hammingPacked(a: PackedHypervector, b: PackedHypervector): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += popcount32(a[i] ^ b[i]);
  return diff;
}

/**
 * Cosine similarity in [-1, 1] computed from packed vectors. Identical result to
 * `cosineSimilarity` on the bipolar form, since for bipolar vectors
 * `cos = (D - 2 * hamming) / D`.
 */
export function similarityPacked(
  a: PackedHypervector,
  b: PackedHypervector,
  dimensions: number,
): number {
  return (dimensions - 2 * hammingPacked(a, b)) / dimensions;
}
