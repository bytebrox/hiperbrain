# @hiperbrain/core

A tiny **Hyperdimensional Computing (HDC / VSA)** engine — the brain behind
[hiperbrain.com](https://www.hiperbrain.com), as a zero-dependency library.

Teach it facts and it learns **one-shot**, answers by **analogy**, and degrades
**gracefully** under noise — all with plain CPU math on typed arrays. No GPU, no
training loop, no external API. The same input always produces the same vector,
so results are deterministic and auditable.

Runs anywhere JavaScript runs: **browser, Node, Edge, Deno, Bun.**

```bash
npm install @hiperbrain/core
```

## Quickstart

### A collective knowledge brain

```ts
import { KnowledgeBrain } from "@hiperbrain/core";

const brain = new KnowledgeBrain();

brain.learn({ subject: "France", relation: "capital", object: "Paris" });
brain.learn({ subject: "Japan", relation: "capital", object: "Tokyo" });
brain.learn({ subject: "France", relation: "currency", object: "Euro" });
brain.learn({ subject: "Japan", relation: "currency", object: "Yen" });

brain.ask("France", "capital");        // → [{ name: "Paris", score: ... }, ...]
brain.askSubject("capital", "Tokyo");  // → [{ name: "Japan", ... }]

// "France is to Euro as Japan is to ___ ?"  (no rule tells it the relation)
brain.analogy("Euro", "France", "Japan"); // → [{ name: "Yen", ... }]
```

### One-shot text classification

```ts
import { Brain } from "@hiperbrain/core";

const brain = new Brain();
brain.learnClass("en", ["the quick brown fox"]);
brain.learnClass("de", ["der schnelle braune fuchs"]);

brain.classify("a lazy dog");  // → [{ name: "en", score: ... }, ...]
```

### Raw primitives

```ts
import { bind, bundle, permute, cosineSimilarity, seededHypervector } from "@hiperbrain/core";

const a = seededHypervector("apple");
const b = seededHypervector("red");
const bound = bind(a, b);                 // role/filler association (self-inverse)
cosineSimilarity(bind(bound, b), a);      // ≈ 1  — recover `a`
```

## What's inside

| Export | What it does |
| --- | --- |
| `bind`, `bundle`, `permute` | The three core HDC operations |
| `cosineSimilarity`, `hammingDistance`, `corrupt` | Compare and stress-test vectors |
| `seededHypervector`, `randomHypervector` | Deterministic / random 10,000-d vectors |
| `ItemMemory` | Cleanup memory (nearest atomic symbol), JSON-serializable |
| `LetterCodebook`, `encodeText` | Character n-gram text encoder |
| `Brain` | Records, analogy, classification, sequences, persistence |
| `KnowledgeBrain` | Collective (subject, relation, object) associative memory |

## Why HDC?

- **One-shot learning** — a fact is learned in a single superposition step.
- **Analogical reasoning** — "the X of Y" falls straight out of vector algebra.
- **Fault tolerant** — flip thousands of bits and recall still works.
- **Deterministic & explainable** — same input → same vector, every time.
- **Tiny & portable** — no dependencies, no GPU, runs at the edge.

## License

MIT
