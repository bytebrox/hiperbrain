<h1 align="center">hiperbrain</h1>

<p align="center">
  <img src="public/banner.png" alt="hiperbrain banner" width="100%" />
</p>
<p align="center">
  <b>A collective brain that thinks in 10,000 dimensions.</b>
</p>

[**www.hiperbrain.com**](https://www.hiperbrain.com)

hiperbrain is **not** another ChatGPT wrapper. It is a small, real, brain-inspired
computing engine built on **Hyperdimensional Computing (HDC / Vector Symbolic
Architectures)** - the same family of ideas neuroscientists use to model how
biological memory might actually work.

You teach it facts. You ask it questions. It answers - not by calling a giant
language model in some data center, but by doing pure mathematics on enormous
vectors, **live in your browser**. No GPU. No language model. No per-question API bill.

And the knowledge is **shared**: every fact anyone teaches becomes part of one
collective memory that everyone draws from. A brain that the whole internet
builds together.

---

## Try it in one line

The entire interface is a single command line - search-engine simple:

- **Ask** &nbsp;`relation of subject` &nbsp;->&nbsp; `capital of France`
- **Teach** &nbsp;`relation of subject is object` &nbsp;->&nbsp; `capital of Spain is Madrid`
- **Reason** &nbsp;`A is to B as C is to ?` &nbsp;->&nbsp; `USA is to Dollar as Mexico is to ?` &nbsp;->&nbsp; **Peso**
- **Explore** &nbsp;`concepts like subject` &nbsp;->&nbsp; `concepts like France` &nbsp;->&nbsp; its nearest neighbours

That last one is the kicker: nobody ever taught it that "Dollar relates to Peso."
It works out the analogy from vector algebra alone. While you play, a living,
self-organising 3D neural map shows the brain thinking, and the live
[activity log](https://www.hiperbrain.com/logs) streams every fact the world teaches
it, in real time.

---

## Why people stop and stare

- **It reasons by analogy - and shows its work.** Ask `USA is to Dollar as
  Mexico is to ?` and it answers **Peso** - a relationship it was never explicitly
  taught - then tells you the relation it *deduced* on the way (`currency`). The
  reasoning is two multiplications you can audit, not a black box.
- **It knows when it knows.** Every answer is scored in *noise sigmas* above
  chance, so the brain reports calibrated confidence instead of a hard-coded
  threshold - and degrades into an honest "unsure" rather than a confident wrong
  answer.
- **It finds related concepts on its own.** `concepts like France` surfaces its
  nearest neighbours by comparing holographic records - emergent structure with
  no clustering step, no embeddings model, no training.
- **It forgives your typos.** Misspell `Frnace` and a fault-tolerant resolver
  still lands on the concept you meant - the engine's noise tolerance applied to
  your keyboard.
- **It is not an LLM.** No transformer, no prompt, no hallucinations from a
  black box. The answer literally falls out of vector algebra - and you can read
  the entire engine end to end.
- **It learns in one shot.** Teaching a new fact is a *single* mathematical step.
  No training run, no fine-tuning, no waiting. Type it; it knows it instantly.
- **It thinks in your browser.** All the heavy math runs client-side on a normal
  CPU, accelerated by a *bit-packed* engine (bind becomes `XOR`, similarity
  becomes `popcount`) that is 8x smaller in memory. The server only stores tiny
  lines of text.
- **It is fault-tolerant like real memory.** Concepts are smeared
  *holographically* across all 10,000 dimensions. Corrupt a third of the vector
  and the right answer still comes back - there is an interactive demo of exactly
  this on the [docs](https://www.hiperbrain.com/docs) page.
- **It grows with the crowd.** Knowledge is additive and order-independent, so
  thousands of people can pour facts into the same memory with zero coordination.

## Not an LLM - a genuinely different kind of AI

Mainstream AI is either a black-box neural network or brittle symbolic logic.
Hyperdimensional Computing is a long-overlooked third path:

| | Large language models | hiperbrain (HDC) |
|---|---|---|
| Transparency | Black box, billions of weights | Read the whole engine yourself |
| Learning | Train for weeks on huge corpora | One step, instant, one-shot |
| Hardware | GPU clusters, per-call cost | Plain CPU, in your browser, free |
| Reasoning | Implicit, unverifiable | Explicit, inspectable algebra |
| Robustness | Fragile to weight corruption | Survives losing a third of its bits |

HDC has decades of peer-reviewed research behind it - it has just never been a
thing the public could *touch*. That is what this is.

---

## How it actually works

Every concept - a word or short phrase - maps to a random vector with
`D = 10,000` components that are simply `-1` or `+1`. In such high-dimensional
space, two random vectors are almost always *near-orthogonal*, which leaves
effectively unlimited room for distinct concepts that never interfere with each
other.

Everything is built from three reversible operations:

- **bind** (`⊗`) associates two vectors (a role with a value, like
  `capital ⊗ Paris`),
- **bundle** superimposes many vectors into one "set" that stays similar to each
  member,
- **permute** shifts components to encode order, position and time.

A fact `(subject, relation, object)` is stored by binding `subject ⊗ object` and
bundling it into a memory vector for that relation. A question is answered by
binding the known part back in and **cleaning up** the noisy result against the
known concepts - and the answer simply emerges. No lookup table. No neural
network. Just algebra.

The full, plain-language walkthrough lives on the in-app
[docs](https://www.hiperbrain.com/docs) page.

---

## One shared, collective brain

- **Shared knowledge, local computation.** Facts live as tiny text triples; every
  browser rebuilds the brain from them and runs all the vector math itself.
- **Additive by nature.** Because bundling is commutative, any number of
  contributors fold their facts into the same memory without stepping on each
  other.
- **Live everywhere.** New facts stream to every open tab the instant they are
  taught - watch the map and the log grow as the world teaches it.
- **Graceful capacity.** Each relation's memory has a finite capacity; as it
  fills, recall gets gently fuzzier - just like biological associative memory.

---

## Built to stay clean

The brain is public and writable, so every submission is checked before it joins
the shared memory:

- input validation (length and character-set limits, nonsense rejection),
- a content blocklist filter,
- per-IP rate limiting,
- duplicate detection and a global capacity cap,
- an optional AI fact-check on new claims: a confident *false* is rejected, a
  confident *true* is trusted into recall, and anything *uncertain* (or any
  checker outage) is held back as `disputed` and kept out of recall until an
  admin approves it - *fail-closed for trust, fail-open for availability*.

Every stored fact also carries **provenance** - its source (`seed`, `community`
or `api`), the wallet that taught it (for API writes), the fact-checker verdict
and a confidence score - so the knowledge can be audited.

**Contradictions are resolved, not averaged.** Single-valued relations (a country
has one capital) can have only one correct answer. If a new fact conflicts with
an existing one, the AI checker *adjudicates* which value is right: the winner
stays `active`, the loser is marked `superseded`, and a tie is logged as
`disputed`. Only `active` facts ever feed the vectors, so a wrong or unverified
submission can never corrupt recall - and every resolved conflict is visible on
the [`/logs`](https://www.hiperbrain.com/logs) page.

Crucially, none of this touches how questions are answered: **every answer is
pure vector algebra, with no language model anywhere in the answer path.**
hiperbrain is not an LLM - it only uses one as an optional gatekeeper that
screens what gets *written* into the shared memory.

## Measured, not claimed - the public benchmark

Big claims deserve a number. The [`/benchmark`](https://www.hiperbrain.com/benchmark)
page runs a fixed set of known-answer questions against the live brain in your
browser and reports **accuracy**, **precision** (correct among confident answers)
and the **confident-wrong rate** - the HDC analogue of hallucination. Because the
brain abstains instead of guessing, that last number stays near zero: it says
"I don't know" rather than inventing an answer.

---

## It's a real engine, not a mock-up - use it yourself

The core is published on npm as a tiny, **dependency-free** package -
[`@hiperbrain/core`](https://www.npmjs.com/package/@hiperbrain/core) - and it is
the *exact same engine* that powers this site. It runs anywhere JavaScript runs:
browser, Node, Edge, Deno, Bun.

[![npm](https://img.shields.io/npm/v/@hiperbrain/core?color=22d3ee&label=%40hiperbrain%2Fcore)](https://www.npmjs.com/package/@hiperbrain/core)

```bash
npm install @hiperbrain/core
```

```ts
import { KnowledgeBrain, recallConfidence } from "@hiperbrain/core";

const brain = new KnowledgeBrain();
brain.learn({ subject: "France", relation: "capital",  object: "Paris" });
brain.learn({ subject: "France", relation: "currency", object: "Euro" });
brain.learn({ subject: "Japan",  relation: "currency", object: "Yen" });

brain.ask("France", "capital")[0].name;    // "Paris"
brain.analogy("Yen", "Japan", "France");   // -> Euro (never explicitly paired)
brain.recoverRelation("Yen", "Japan");     // -> "currency" (the deduced relation)
brain.similarConcepts("France");           // -> nearest entities by record
recallConfidence(brain.ask("France", "capital")); // -> { confident, sigma, score }
```

You also get a typo-tolerant `ConceptResolver`, the raw primitives (`bind`,
`bundle`, `permute`, `cosineSimilarity`), a bit-packed fast path (`packBits`,
`bindPacked`, `similarityPacked`) and a `Brain` facade for records, one-shot text
classification and sequence memory - learning and reasoning in a few kilobytes
of math. See the [package README](packages/core/README.md) for the full API.

---

## Token & API - reason over the live collective brain

The SDK runs offline and knows only what you teach it. The **hiperbrain** token
unlocks the other half: a credit-metered HTTP API that reasons over the *live
collective brain* - every fact the community has ever taught - from your own
apps, scripts and agents. The public brain on the home page stays free; the
token only meters this programmatic layer.

It works as a genuine **token sink**:

1. **Burn** hiperbrain tokens on Solana (the burn is verified on-chain).
2. Your wallet is granted off-chain **credits** (1 token = 1 credit, configurable).
3. A read (`ask`) costs 1 credit; a permanent, AI-verified write (`teach`) costs 10.

```bash
curl -X POST https://www.hiperbrain.com/api/v1/ask \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"subject":"France","relation":"capital"}'
# -> { "answer": "Paris", "confidence": { "confident": true, ... }, "remaining": 999 }
```

Connect a wallet, burn for credits and mint an API key on the
[Token & API](https://www.hiperbrain.com/token) page. All RPC stays server-side
(via Helius), every redemption is replay-protected by the burn signature, and
keys are looked up by SHA-256 hash. Keys are also stored encrypted at rest
(AES-256-GCM) so their owner can re-view, revoke and re-create them from the
dashboard after signing in with their wallet. The economy is configured through
env vars (`NEXT_PUBLIC_TOKEN_MINT`, `CREDITS_PER_TOKEN`, `CREDITS_COST_ASK`,
`CREDITS_COST_TEACH`, and `API_KEY_ENC_SECRET` for at-rest key encryption);
run [`supabase/credits.sql`](supabase/credits.sql) once to create the ledger.

---

## Further reading

- Pentti Kanerva, *Hyperdimensional Computing: An Introduction to Computing in Distributed Representation with High-Dimensional Random Vectors* (2009).
- Pentti Kanerva, *Sparse Distributed Memory* (1988).
- Tony Plate, *Holographic Reduced Representations* (1995).

## License

MIT - see [`LICENSE`](LICENSE).
