---
"@hiperbrain/core": minor
---

Make `KnowledgeBrain` scale to hundreds of thousands of facts.

Symbols are now cached only in their bit-packed form (~1.25 KB instead of ~10 KB) and per-subject records are rebuilt on demand from their (relation, object) pairs instead of keeping a dense 40 KB accumulator each. Binding and the majority vote for small records run directly in the packed domain, and symbols are generated 32 bits per draw. Together this cuts a 150k-fact brain from multiple GB to a few hundred MB and builds it in seconds, with `similarConcepts` an order of magnitude faster. Recall results are unchanged (HDC is basis-independent).

Adds `seededPackedHypervector` and `packedTieSigns` helpers.
