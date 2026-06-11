/**
 * Item memory (a.k.a. "cleanup memory").
 *
 * HDC computations produce noisy hypervectors: binding and bundling many
 * vectors together yields a result that is only *approximately* equal to the
 * clean atomic vectors. The item memory stores the known, clean atomic vectors
 * by name and, given a noisy query, returns the closest matches. This is the
 * step that turns an approximate vector back into a concrete symbol.
 */

import { cosineSimilarity, type Hypervector } from "./hypervector";

/** A single ranked match returned by the item memory. */
export interface Match {
  name: string;
  /** Cosine similarity in [-1, 1]; higher means more similar. */
  score: number;
}

/** Serializable form of an item memory, safe to store in JSON/localStorage. */
export interface SerializedItemMemory {
  dimensions: number;
  items: Record<string, number[]>;
}

export class ItemMemory {
  private items = new Map<string, Hypervector>();

  /** Store (or overwrite) a named atomic hypervector. */
  add(name: string, vector: Hypervector): void {
    this.items.set(name, vector);
  }

  /** Retrieve a stored vector by name, or `undefined` if unknown. */
  get(name: string): Hypervector | undefined {
    return this.items.get(name);
  }

  has(name: string): boolean {
    return this.items.has(name);
  }

  delete(name: string): boolean {
    return this.items.delete(name);
  }

  clear(): void {
    this.items.clear();
  }

  /** All stored names, in insertion order. */
  names(): string[] {
    return [...this.items.keys()];
  }

  get size(): number {
    return this.items.size;
  }

  /**
   * Rank every stored vector by similarity to `query` and return the top `k`.
   * This is the core "cleanup" operation.
   */
  nearest(query: Hypervector, k = 1): Match[] {
    const matches: Match[] = [];
    for (const [name, vector] of this.items) {
      matches.push({ name, score: cosineSimilarity(query, vector) });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, k);
  }

  /** Convenience: the single best matching name, or `null` if memory is empty. */
  cleanup(query: Hypervector): Match | null {
    return this.nearest(query, 1)[0] ?? null;
  }

  toJSON(dimensions: number): SerializedItemMemory {
    const items: Record<string, number[]> = {};
    for (const [name, vector] of this.items) {
      items[name] = Array.from(vector);
    }
    return { dimensions, items };
  }

  static fromJSON(data: SerializedItemMemory): ItemMemory {
    const memory = new ItemMemory();
    for (const [name, values] of Object.entries(data.items)) {
      memory.add(name, Int8Array.from(values));
    }
    return memory;
  }
}
