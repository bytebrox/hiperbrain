---
"@hiperbrain/core": minor
---

Sharper recall at scale: `KnowledgeBrain.ask()` now recovers the answer from the subject's own holographic record first (`record(subject) ⊗ relation`), falling back to the relation bundle only when that is stronger. Recall accuracy now scales with facts-per-subject instead of facts-per-relation, so common questions stay confident even when a relation holds tens of thousands of facts. Fully backward compatible — no API changes, and the relation-bundle path remains as a fallback.
