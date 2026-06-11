/**
 * Core hypervector primitives for Hyperdimensional Computing (HDC / VSA).
 *
 * A hypervector is a very high-dimensional, bipolar vector whose components are
 * either `-1` or `+1`. We represent it as an `Int8Array` for compactness and
 * fast element-wise math on the CPU.
 *
 * The three fundamental HDC operations are:
 *  - `bind`   : element-wise multiplication. Combines two vectors into a new one
 *               that is dissimilar to both. Used for key/value (role/filler)
 *               associations. It is its own inverse for bipolar vectors.
 *  - `bundle` : element-wise majority vote. Superimposes several vectors into one
 *               that is *similar* to each input. Used to represent sets/memories.
 *  - `permute`: cyclic shift. Produces a dissimilar vector while preserving
 *               structure. Used to encode order, position and time.
 *
 * Similarity between two hypervectors is measured with cosine similarity, which
 * for bipolar vectors simplifies to `dot(a, b) / D`.
 */

/** A bipolar hypervector. Every component is either -1 or +1. */
export type Hypervector = Int8Array;

/** Default dimensionality. 10,000 is the canonical HDC working size. */
export const DIMENSIONS = 10000;

/**
 * Mulberry32: a tiny, fast, deterministic pseudo-random number generator.
 * Returns a function producing floats in [0, 1). Used so that vector creation
 * is reproducible (important for tests and for persisting a brain by name).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash of a string (FNV-1a variant). */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Create a random bipolar hypervector using the provided RNG. */
export function randomHypervector(
  dimensions: number = DIMENSIONS,
  rng: () => number = Math.random,
): Hypervector {
  const v = new Int8Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    v[i] = rng() < 0.5 ? -1 : 1;
  }
  return v;
}

/**
 * Create a deterministic hypervector derived from a label. The same label
 * (and seed) always yields the same vector, which lets us regenerate atomic
 * symbols without storing them.
 */
export function seededHypervector(
  label: string,
  dimensions: number = DIMENSIONS,
  seed = 0,
): Hypervector {
  const rng = mulberry32((hashString(label) ^ Math.imul(seed, 0x9e3779b1)) >>> 0);
  return randomHypervector(dimensions, rng);
}

/** Assert that two vectors share the same dimensionality. */
function assertSameLength(a: Hypervector, b: Hypervector): void {
  if (a.length !== b.length) {
    throw new Error(
      `Hypervector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }
}

/**
 * Bind two hypervectors via element-wise multiplication.
 * The result is dissimilar to both inputs and is its own inverse:
 * `bind(bind(a, b), b) === a`.
 */
export function bind(a: Hypervector, b: Hypervector): Hypervector {
  assertSameLength(a, b);
  const out = new Int8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = (a[i] * b[i]) as -1 | 1;
  }
  return out;
}

/** Bind any number of hypervectors together (left to right). */
export function bindAll(vectors: Hypervector[]): Hypervector {
  if (vectors.length === 0) {
    throw new Error("bindAll requires at least one vector");
  }
  let acc = vectors[0];
  for (let i = 1; i < vectors.length; i++) {
    acc = bind(acc, vectors[i]);
  }
  return acc;
}

/**
 * Bundle (superimpose) several hypervectors with an element-wise majority vote.
 * The result is similar to every input. Ties (a sum of exactly zero, possible
 * with an even number of inputs) are resolved deterministically to +1.
 */
export function bundle(vectors: Hypervector[]): Hypervector {
  if (vectors.length === 0) {
    throw new Error("bundle requires at least one vector");
  }
  const dim = vectors[0].length;
  const sums = new Int32Array(dim);
  for (const v of vectors) {
    assertSameLength(vectors[0], v);
    for (let i = 0; i < dim; i++) {
      sums[i] += v[i];
    }
  }
  const out = new Int8Array(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = sums[i] >= 0 ? 1 : -1;
  }
  return out;
}

/**
 * Add a hypervector into a running integer accumulator. Useful when bundling
 * a large or streaming set of vectors without allocating an array first.
 */
export function accumulate(acc: Int32Array, v: Hypervector): void {
  for (let i = 0; i < acc.length; i++) {
    acc[i] += v[i];
  }
}

/** Convert an integer accumulator into a bipolar hypervector via sign. */
export function finalizeAccumulator(acc: Int32Array): Hypervector {
  const out = new Int8Array(acc.length);
  for (let i = 0; i < acc.length; i++) {
    out[i] = acc[i] >= 0 ? 1 : -1;
  }
  return out;
}

/**
 * Cyclically shift a hypervector by `shift` positions. Permutation produces a
 * vector dissimilar to the original and is used to encode position/order.
 */
export function permute(v: Hypervector, shift = 1): Hypervector {
  const dim = v.length;
  const normalized = ((shift % dim) + dim) % dim;
  if (normalized === 0) {
    return v.slice();
  }
  const out = new Int8Array(dim);
  for (let i = 0; i < dim; i++) {
    out[(i + normalized) % dim] = v[i];
  }
  return out;
}

/**
 * Cosine similarity in [-1, 1]. For bipolar vectors this reduces to the dot
 * product divided by the dimensionality. Random vectors are near 0 (orthogonal),
 * identical vectors are 1, opposite vectors are -1.
 */
export function cosineSimilarity(a: Hypervector, b: Hypervector): number {
  assertSameLength(a, b);
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot / a.length;
}

/** Hamming distance: the number of positions at which two vectors differ. */
export function hammingDistance(a: Hypervector, b: Hypervector): number {
  assertSameLength(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

/**
 * Return a noisy copy of `v` with `ratio` (0..1) of its components flipped.
 * Demonstrates HDC's graceful, holographic degradation under damage.
 */
export function corrupt(
  v: Hypervector,
  ratio: number,
  rng: () => number = Math.random,
): Hypervector {
  const out = v.slice();
  const flips = Math.round(Math.min(1, Math.max(0, ratio)) * v.length);
  const indices = new Set<number>();
  while (indices.size < flips) {
    indices.add(Math.floor(rng() * v.length));
  }
  for (const i of indices) {
    out[i] = (out[i] * -1) as -1 | 1;
  }
  return out;
}
