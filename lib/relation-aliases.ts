/**
 * Relation aliases - everyday phrasing mapped onto the canonical relation the
 * brain actually stores facts under. This lets people ask the way they speak:
 *
 *   "money of Japan"        -> currency of Japan
 *   "capital city of Spain" -> capital of Spain
 *   "antonym of hot"        -> opposite of hot
 *   "who leads Tesla?"      -> ceo of Tesla   (see VERB_RELATIONS)
 *
 * Applied at the brain boundary on BOTH sides - when a fact is written (so the
 * store stays consistent) and when a question is asked (so synonyms resolve) -
 * which keeps read and write in lockstep.
 *
 * Only unambiguous, high-frequency synonyms belong here. When a word could mean
 * several relations (e.g. "leader" -> president or CEO?), it is deliberately
 * left out so the brain never silently answers a different question than asked.
 */

const RELATION_ALIASES: Record<string, string> = {
  // currency
  money: "currency",
  "currency used": "currency",
  // capital
  "capital city": "capital",
  // colour spelling
  colour: "color",
  "flag colour": "flag color",
  // opposites
  antonym: "opposite",
  antonyms: "opposite",
  opposites: "opposite",
  // organisations / people
  "chief executive": "ceo",
  "chief executive officer": "ceo",
  // speed
  "max speed": "top speed",
  "maximum speed": "top speed",
  // size
  "atomic no": "atomic number",
};

/**
 * Verb-style questions: "who <verb> <subject>" -> ask the mapped relation.
 * e.g. "who leads Tesla" -> { relation: "ceo", subject: "Tesla" }.
 * Only verbs with a single clear relation are listed.
 */
export const VERB_RELATIONS: Record<string, string> = {
  leads: "ceo",
  runs: "ceo",
  heads: "ceo",
  founded: "founder",
  cofounded: "founder",
  "co-founded": "founder",
  invented: "inventor",
  wrote: "author",
  authored: "author",
  directed: "director",
  discovered: "discoverer",
  composed: "composer",
  painted: "painter",
  designed: "designer",
};

/** Normalise a relation (lowercase, collapse spaces) and resolve any alias. */
export function canonicalRelation(relation: string): string {
  const key = relation.replace(/\s+/g, " ").trim().toLowerCase();
  return RELATION_ALIASES[key] ?? key;
}
