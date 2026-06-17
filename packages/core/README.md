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
brain.analogy("Euro", "France", "Japan");  // → [{ name: "Yen", ... }]
brain.recoverRelation("Euro", "France");   // → [{ name: "currency", ... }]  (explainable)
brain.similarConcepts("France");           // → nearest entities by holographic record
```

### Calibrated confidence

```ts
import { recallConfidence } from "@hiperbrain/core";

const matches = brain.ask("France", "capital");
recallConfidence(matches); // → { score, confident, sigma }  (noise-sigma calibrated)
```

### Typo-tolerant resolution

```ts
import { ConceptResolver } from "@hiperbrain/core";

const resolver = new ConceptResolver(["France", "Germany", "Japan"]);
resolver.resolve("Frnace")?.name; // → "France"
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
| `packBits`, `unpackBits`, `bindPacked`, `similarityPacked` | Bit-packed fast path (8x smaller; bind = XOR, similarity = popcount) |
| `ItemMemory` | Cleanup memory (nearest atomic symbol), JSON-serializable |
| `LetterCodebook`, `encodeText` | Character n-gram text encoder |
| `ConceptResolver` | Typo-tolerant lookup of known names |
| `Brain` | Records, analogy, classification, sequences, persistence |
| `KnowledgeBrain` | Collective (subject, relation, object) memory with analogy, `recoverRelation`, `similarConcepts` |
| `recallConfidence` | Noise-sigma calibrated confidence for any ranked result |

## Why HDC?

- **One-shot learning** — a fact is learned in a single superposition step.
- **Analogical reasoning** — "the X of Y" falls straight out of vector algebra.
- **Fault tolerant** — flip thousands of bits and recall still works.
- **Deterministic & explainable** — same input → same vector, every time.
- **Tiny & portable** — no dependencies, no GPU, runs at the edge.

## Hosted API — reason over the live collective brain

Everything above runs **fully offline** and knows only what you teach it. To
reason over the **live collective brain** — every fact the community has taught
on [hiperbrain.com](https://www.hiperbrain.com) — use the built-in
`HiperbrainClient`. It wraps the hosted, **credit-metered** HTTP API, so every
call requires an API key and spends credits server-side. A read (`ask`) costs 1
credit; a permanent, AI-verified write (`teach`) costs 10 and is refunded
automatically if the fact does not land.

Mint a key by burning tokens for credits at
[hiperbrain.com/token](https://www.hiperbrain.com/token).

```ts
import { HiperbrainClient } from "@hiperbrain/core";

const hb = new HiperbrainClient({ apiKey: "hb_live_..." }); // key is required

// Ask — 1 credit
const { answer, confidence, remaining } = await hb.ask("France", "capital");
//    → "Paris", { confident: true, ... }, 999

// Teach — 10 credits (refunded if it's a duplicate / rejected / lost a conflict)
await hb.teach({ subject: "Slovenia", relation: "capital", object: "Ljubljana" });

// Check the balance — free, spends nothing
await hb.balance(); // → 989
```

Out of credits or a bad key throws a typed `HiperbrainApiError`:

```ts
import { HiperbrainApiError } from "@hiperbrain/core";

try {
  await hb.ask("France", "capital");
} catch (e) {
  if (e instanceof HiperbrainApiError && e.outOfCredits) {
    // 402 — burn more tokens at /token to top up
  }
}
```

Self-hosting? Point the client at your own deployment with
`new HiperbrainClient({ apiKey, baseUrl: "https://your-host" })`. On runtimes
without a global `fetch` (Node < 18) pass one via the `fetch` option.

## License

MIT
