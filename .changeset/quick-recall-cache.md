---
"@hiperbrain/core": patch
---

perf: cache bit-packed entity records and avoid per-recall candidate allocation

- `similarConcepts` reuses cached packed records (invalidated on `learn`) instead
  of re-packing every entity's record on each query.
- `cleanup` iterates relation candidate sets directly with an `exclude` filter,
  so `ask`/`askSubject`/`analogy` no longer allocate a filtered array per call.
- Corrected the `bundle` doc comment to describe the deterministic per-index
  tie sign (no behaviour change).
