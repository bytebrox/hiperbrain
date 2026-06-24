# @hiperbrain/core

## 0.4.1

### Patch Changes

- 3365ee9: perf: cache bit-packed entity records and avoid per-recall candidate allocation

  - `similarConcepts` reuses cached packed records (invalidated on `learn`) instead
    of re-packing every entity's record on each query.
  - `cleanup` iterates relation candidate sets directly with an `exclude` filter,
    so `ask`/`askSubject`/`analogy` no longer allocate a filtered array per call.
  - Corrected the `bundle` doc comment to describe the deterministic per-index
    tie sign (no behaviour change).

## 0.4.0

### Minor Changes

- 195b114: Add `HiperbrainClient`, a typed, zero-dependency client for the hosted
  credit-metered API. It wraps `ask`, `teach` and `balance` over `/api/v1`,
  requires an API key, and throws a typed `HiperbrainApiError` (with
  `outOfCredits` / `unauthorized`) on failure. The offline HDC engine is
  unchanged; this is the opt-in path to reason over the live collective brain.

## 0.3.0

### Minor Changes

- 794125c: Sharper recall at scale: `KnowledgeBrain.ask()` now recovers the answer from the subject's own holographic record first (`record(subject) ⊗ relation`), falling back to the relation bundle only when that is stronger. Recall accuracy now scales with facts-per-subject instead of facts-per-relation, so common questions stay confident even when a relation holds tens of thousands of facts. Fully backward compatible — no API changes, and the relation-bundle path remains as a fallback.

## 0.2.0

### Minor Changes

- 26a3b09: Smarter, faster engine:

  - **Bit-packed hypervectors** (`packBits`, `unpackBits`, `bindPacked`, `hammingPacked`, `similarityPacked`): 8x smaller memory and a much faster cleanup path (bind = XOR, similarity = popcount), used internally by `KnowledgeBrain`.
  - **Explainable analogy** via `KnowledgeBrain.recoverRelation()` — returns the relation the analogy deduced purely from algebra.
  - **Semantic neighbours** via `KnowledgeBrain.similarConcepts()` — nearest entities by holographic record, no clustering step.
  - **Calibrated confidence** via `recallConfidence()` — expresses a result's strength in noise sigmas instead of a fixed threshold.
  - **Typo-tolerant `ConceptResolver`** — resolves misspelled names ("Frnace" → "France") with a multi-resolution n-gram fingerprint.
  - **Correctness:** unbiased bundle tie-breaking (no more drift toward the all-ones vector) and collision-resistant seeding (xmur3 + sfc32) for hundreds of thousands of distinct concepts.

## 0.1.1

### Patch Changes

- b0f064e: Verify the automated npm release pipeline (Changesets + GitHub Actions). No API changes.
