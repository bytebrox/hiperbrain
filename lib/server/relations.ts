/**
 * Which relations are *functional* (single-valued) versus multi-valued.
 *
 * A functional relation can have only one correct object for a given subject:
 * a country has exactly one capital, a substance one boiling point. Teaching a
 * second, different object is therefore a contradiction that must be resolved.
 *
 * Multi-valued relations (a country's languages, a node's neighbours, a band's
 * members) can legitimately hold many objects, so a "second" value is not a
 * conflict and is simply added.
 *
 * The list is deliberately curated and conservative: when in doubt a relation
 * is treated as multi-valued, so we never wrongly reject a legitimate extra
 * value. Extend `FUNCTIONAL_RELATIONS` as the knowledge base grows.
 */

const FUNCTIONAL_RELATIONS = new Set<string>([
  "capital",
  "currency",
  "continent",
  "country",
  "color",
  "colour",
  "sound",
  "population",
  "area",
  "author",
  "director",
  "founder",
  "ceo",
  "president",
  "inventor",
  "discoverer",
  "symbol",
  "atomic number",
  "boiling point",
  "melting point",
  "density",
  "capital city",
  "nationality",
  "birthplace",
  "birth year",
  "birthday",
  "height",
  "weight",
  "diameter",
  "radius",
  "mass",
  "speed",
  "top speed",
  "official language",
  "time zone",
  "largest city",
  "highest point",
  "national animal",
  "national dish",
  "flag color",
  "opposite",
  "antonym",
  "plural",
  "chemical formula",
  "molecular formula",
]);

/**
 * Normalise a relation the same way the moderation layer does (lowercased,
 * whitespace collapsed) before checking it against the curated set.
 */
export function isFunctional(relation: string): boolean {
  const key = relation.replace(/\s+/g, " ").trim().toLowerCase();
  return FUNCTIONAL_RELATIONS.has(key);
}
