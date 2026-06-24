/**
 * Automated knowledge ingestion from Wikidata.
 *
 * Wikidata is the structured data behind Wikipedia: ~115M entities, each a bag
 * of (property, value) statements. That maps almost 1:1 onto hiperbrain's
 * (subject, relation, object) triples, it's CC0 (public domain), and its public
 * SPARQL endpoint needs no API key. This script runs a curated set of SPARQL
 * queries, turns each result row into a triple, sanitizes it exactly like the
 * app would, and idempotently upserts it into Supabase.
 *
 * Each dataset targets a *functional* relation (one clear value per subject,
 * e.g. a country's capital). Those keep HDC recall sharp: a subject's own
 * holographic record holds only a handful of facts, so the answer stays crisp
 * no matter how large the relation bucket grows.
 *
 * Run (all datasets):
 *   node --env-file=.env.local scripts/seed-wikidata.mjs
 *
 * Run specific datasets:
 *   node --env-file=.env.local scripts/seed-wikidata.mjs capital currency
 *
 * Tune volume per query (default 5000):
 *   WIKIDATA_LIMIT=20000 node --env-file=.env.local scripts/seed-wikidata.mjs
 */

import { dedupe, getSupabase, countFacts, upsertFacts } from "./lib/ingest.mjs";

const ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata requires a descriptive User-Agent or it returns 403/429.
const USER_AGENT =
  "hiperbrain-seeder/1.0 (https://www.hiperbrain.com; data ingestion bot)";
const LIMIT = Number(process.env.WIKIDATA_LIMIT ?? 5000);
const DELAY_MS = Number(process.env.WIKIDATA_DELAY_MS ?? 1500);

/**
 * Build a dataset for a single Wikidata property using the bounded sub-query
 * pattern: grab the first LIMIT statements of the property, then let the label
 * service name only that bounded set. This is timeout-proof for ANY property,
 * including ones held by millions of entities (a top-level `wdt:Pxx` triple with
 * a LIMIT still scans the whole property first, which times out at scale).
 *
 * `forward` is the human-readable relation written subject→object. Pass
 * `{ reverse }` to also write the inverse triple object→subject.
 */
function prop(forward, pid, { reverse } = {}) {
  return {
    forward,
    ...(reverse ? { reverse } : {}),
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      { SELECT ?subject ?object WHERE { ?subject wdt:${pid} ?object } LIMIT ${LIMIT} }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`,
  };
}

/**
 * Each dataset SELECTs exactly two columns, `?subjectLabel` and `?objectLabel`.
 * `forward` is the relation subject→object; `reverse` (optional) also writes
 * the inverse triple object→subject, which lets the brain answer both
 * directions ("capital of France" and "country of Paris").
 *
 * Most datasets target a clean, recognisable relation. Some are functional (one
 * value per subject, e.g. capital) and some are multi-valued (e.g. award,
 * borders); both are fine — the brain superimposes a subject's facts either way.
 */
const DATASETS = {
  capital: {
    forward: "capital",
    reverse: "country",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q6256 ; wdt:P36 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  currency: {
    forward: "currency",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q6256 ; wdt:P38 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  continent: {
    forward: "continent",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q6256 ; wdt:P30 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  language: {
    forward: "official language",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q6256 ; wdt:P37 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  director: {
    forward: "director",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q11424 ; wdt:P57 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  author: {
    forward: "author",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q7725634 ; wdt:P50 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  symbol: {
    // P246 is a literal string (e.g. "Fe"), so there is no entity to label.
    forward: "symbol",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q11344 ; wdt:P246 ?objectLabel .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  headquarters: {
    forward: "headquarters",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q4830453 ; wdt:P159 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  founder: {
    forward: "founder",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q4830453 ; wdt:P112 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  genre: {
    forward: "genre",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P31 wd:Q11424 ; wdt:P136 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  inventor: {
    forward: "inventor",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      ?subject wdt:P61 ?object .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT ${LIMIT}`,
  },
  // Person datasets: properties P27/P19/P106 are held almost exclusively by
  // humans, so we skip the expensive `wdt:P31 wd:Q5` join (Q5 has ~10M members
  // and gets fully scanned before LIMIT, which times out). Selecting the
  // entities in an inner sub-query with LIMIT lets the engine stop early, then
  // the label service only labels that bounded set.
  nationality: {
    forward: "nationality",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      { SELECT ?subject ?object WHERE { ?subject wdt:P27 ?object } LIMIT ${LIMIT} }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`,
  },
  birthplace: {
    forward: "birthplace",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      { SELECT ?subject ?object WHERE { ?subject wdt:P19 ?object } LIMIT ${LIMIT} }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`,
  },
  occupation: {
    forward: "occupation",
    query: `SELECT ?subjectLabel ?objectLabel WHERE {
      { SELECT ?subject ?object WHERE { ?subject wdt:P106 ?object } LIMIT ${LIMIT} }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`,
  },

  // -------------------------------------------------------------------------
  // Extra relations (bounded sub-query template; see prop()). These widen the
  // brain's vocabulary of relations far beyond the original handful.
  // -------------------------------------------------------------------------

  // Geography / places
  country: prop("country", "P17"),
  locatedin: prop("located in", "P131"),
  borders: prop("borders", "P47"),
  headofstate: prop("head of state", "P35"),
  headofgov: prop("head of government", "P6"),
  anthem: prop("anthem", "P85"),

  // People
  spouse: prop("spouse", "P26"),
  father: prop("father", "P22"),
  mother: prop("mother", "P25"),
  child: prop("child", "P40"),
  educatedat: prop("educated at", "P69"),
  employer: prop("employer", "P108"),
  fieldofwork: prop("field of work", "P101"),
  party: prop("political party", "P102"),
  religion: prop("religion", "P140"),
  award: prop("award", "P166"),
  position: prop("position", "P39"),
  speaks: prop("speaks", "P1412"),
  instrument: prop("instrument", "P1303"),

  // Creative works
  composer: prop("composer", "P86"),
  screenwriter: prop("screenwriter", "P58"),
  producer: prop("producer", "P162"),
  studio: prop("production company", "P272"),
  origlang: prop("original language", "P364"),
  origin: prop("country of origin", "P495"),
  recordlabel: prop("record label", "P264"),
  performer: prop("performer", "P175"),
  basedon: prop("based on", "P144"),
  setin: prop("set in", "P840"),

  // Companies, products & tech
  industry: prop("industry", "P452"),
  ceo: prop("ceo", "P169"),
  parentcompany: prop("parent company", "P749"),
  ownedby: prop("owned by", "P127"),
  manufacturer: prop("manufacturer", "P176"),
  developer: prop("developer", "P178"),
  publisher: prop("publisher", "P123"),
  platform: prop("platform", "P400"),
  os: prop("operating system", "P306"),
  proglang: prop("programming language", "P277"),
  produces: prop("produces", "P1056"),

  // Arts, buildings & nature
  creator: prop("creator", "P170"),
  architect: prop("architect", "P84"),
  movement: prop("movement", "P135"),
  material: prop("made of", "P186"),
  color: prop("color", "P462"),
  sport: prop("sport", "P641"),
  league: prop("league", "P118"),
  team: prop("team", "P54"),
  taxon: prop("parent taxon", "P171"),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST a SPARQL query, retrying with backoff on 429/5xx. */
async function runQuery(query, { tries = 4 } = {}) {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          accept: "application/sparql-results+json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ query }),
      });
    } catch (err) {
      if (attempt === tries) throw err;
      await sleep(DELAY_MS * attempt * 2);
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      return data?.results?.bindings ?? [];
    }

    // Rate limited or server error: back off and retry.
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      await sleep(Math.max(retryAfter * 1000, DELAY_MS * attempt * 2));
      continue;
    }

    throw new Error(`SPARQL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return [];
}

/** Turn one dataset's result rows into forward (+ optional reverse) triples. */
function rowsToTriples(rows, ds) {
  const out = [];
  for (const row of rows) {
    const subject = row.subjectLabel?.value;
    const object = row.objectLabel?.value;
    if (!subject || !object) continue;
    out.push({ subject, relation: ds.forward, object });
    if (ds.reverse) out.push({ subject: object, relation: ds.reverse, object: subject });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(DATASETS);

const unknown = names.filter((n) => !DATASETS[n]);
if (unknown.length) {
  console.error(`Unknown dataset(s): ${unknown.join(", ")}`);
  console.error(`Available: ${Object.keys(DATASETS).join(", ")}`);
  process.exit(1);
}

const supabase = getSupabase();
const before = await countFacts(supabase);
console.log(
  `Ingesting from Wikidata: ${names.join(", ")} (limit ${LIMIT} rows/query)\n`,
);

let grandTotal = 0;
for (let i = 0; i < names.length; i += 1) {
  const name = names[i];
  const ds = DATASETS[name];
  process.stdout.write(`[${name}] querying ... `);
  let rows;
  try {
    rows = await runQuery(ds.query);
  } catch (err) {
    console.log(`failed: ${err.message}`);
    continue;
  }

  const { facts, skipped } = dedupe(rowsToTriples(rows, ds));
  await upsertFacts(supabase, facts);
  grandTotal += facts.length;
  console.log(`${rows.length} rows -> ${facts.length} clean triples (skipped ${skipped}).`);

  if (i < names.length - 1) await sleep(DELAY_MS);
}

const after = await countFacts(supabase);
console.log(
  `\nDone. Prepared ${grandTotal} triples. Facts in DB: ${before} -> ${after} (+${after - before}).`,
);
