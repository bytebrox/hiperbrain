---
"@hiperbrain/core": minor
---

Smarter, faster engine:

- **Bit-packed hypervectors** (`packBits`, `unpackBits`, `bindPacked`, `hammingPacked`, `similarityPacked`): 8x smaller memory and a much faster cleanup path (bind = XOR, similarity = popcount), used internally by `KnowledgeBrain`.
- **Explainable analogy** via `KnowledgeBrain.recoverRelation()` — returns the relation the analogy deduced purely from algebra.
- **Semantic neighbours** via `KnowledgeBrain.similarConcepts()` — nearest entities by holographic record, no clustering step.
- **Calibrated confidence** via `recallConfidence()` — expresses a result's strength in noise sigmas instead of a fixed threshold.
- **Typo-tolerant `ConceptResolver`** — resolves misspelled names ("Frnace" → "France") with a multi-resolution n-gram fingerprint.
- **Correctness:** unbiased bundle tie-breaking (no more drift toward the all-ones vector) and collision-resistant seeding (xmur3 + sfc32) for hundreds of thousands of distinct concepts.
