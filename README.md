# Haiperbrain

### A collective brain that thinks in 10,000 dimensions.

[**haiperbrain.com**](https://haiperbrain.com)

Haiperbrain is **not** another ChatGPT wrapper. It is a small, real, brain-inspired
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

While you do, a living, self-organising 3D neural map shows the brain thinking,
and the live [activity log](https://haiperbrain.com/logs) streams every fact the
world teaches it, in real time.

---

## Why people stop and stare

- **It is not an LLM.** No transformer, no prompt, no hallucinations from a
  black box. The answer literally falls out of vector algebra - and you can read
  the entire engine end to end.
- **It learns in one shot.** Teaching a new fact is a *single* mathematical step.
  No training run, no fine-tuning, no waiting. Type it; it knows it instantly.
- **It thinks in your browser.** All the heavy math runs client-side on a normal
  CPU. The server only stores tiny lines of text. It scales because the
  "thinking" is distributed across every visitor.
- **It is fault-tolerant like real memory.** Concepts are smeared
  *holographically* across all 10,000 dimensions. Corrupt a third of the vector
  and the right answer still comes back - exactly the graceful degradation you
  see in biological brains.
- **It grows with the crowd.** Knowledge is additive and order-independent, so
  thousands of people can pour facts into the same memory with zero coordination.

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
[how-it-works](https://haiperbrain.com/how-it-works) page.

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
- duplicate detection and a global capacity cap.

Simple, transparent, and easy to extend.

---

## It's a real engine, not a mock-up

The core is dependency-free TypeScript you can actually use:

```ts
import { KnowledgeBrain } from "@/lib/hdc";

const brain = new KnowledgeBrain();
brain.learn({ subject: "France", relation: "capital", object: "Paris" });
brain.learn({ subject: "Japan",  relation: "capital", object: "Tokyo" });

brain.ask("France", "capital")[0].name; // "Paris"
```

That's the same engine powering the site - learning and reasoning in a few
kilobytes of math.

---

## Further reading

- Pentti Kanerva, *Hyperdimensional Computing: An Introduction to Computing in Distributed Representation with High-Dimensional Random Vectors* (2009).
- Pentti Kanerva, *Sparse Distributed Memory* (1988).
- Tony Plate, *Holographic Reduced Representations* (1995).

## License

MIT - see [`LICENSE`](LICENSE).
