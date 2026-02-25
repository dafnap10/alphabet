// validate.js
// Real validation using Wikipedia + Wikidata (P31 "instance of").
// - Checks page exists on en.wikipedia.org (with redirects)
// - Checks category match using Wikidata instance-of + Wikipedia categories keyword fallback
// - No LLM required

const CATS = ["Country", "City", "Animal", "Food", "Celebrity", "Brand", "Object"];

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Wikimedia recommends setting a User-Agent
const UA =
  process.env.WIKIMEDIA_USER_AGENT ||
  "AlphabetGameValidator/1.0 (https://alphabetush.vercel.app/; contact: your-email@example.com)";

// Simple in-memory cache (works per serverless instance)
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function normAnswer(s) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "");
}

function startsWithLetter(answer, letter) {
  if (!answer || !letter) return false;
  return answer.trim().toLowerCase().startsWith(letter.trim().toLowerCase());
}

function isObviouslyGibberish(answer) {
  // Keep this conservative; Wikipedia existence is the real filter.
  const a = answer.trim();
  if (a.length < 2) return true;
  // all same char like "aaaa"
  if (/^(.)\1{2,}$/i.test(a)) return true;
  // mostly non-letters (allow spaces, hyphen, apostrophe, dot)
  const letters = (a.match(/[A-Za-z]/g) || []).length;
  if (letters === 0) return true;
  if (letters / a.length < 0.4) return true;
  return false;
}

async function wikiFetch(params) {
  const url = new URL(WIKI_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // origin=* required for CORS in browsers; on server it’s fine but harmless
  url.searchParams.set("origin", "*");

  const r = await fetch(url.toString(), {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
    },
  });
  if (!r.ok) throw new Error(`Wikipedia API error: ${r.status}`);
  return r.json();
}

async function wikidataFetch(params) {
  const url = new URL(WIKIDATA_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const r = await fetch(url.toString(), {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
    },
  });
  if (!r.ok) throw new Error(`Wikidata API error: ${r.status}`);
  return r.json();
}

async function resolveWikipediaPage(answer) {
  const key = `wp:${answer.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // We query:
  // - redirects=1 to follow redirects
  // - prop=pageprops (for wikibase_item)
  // - prop=categories (for fallback keyword checks)
  const data = await wikiFetch({
    action: "query",
    format: "json",
    redirects: "1",
    prop: "pageprops|categories",
    cllimit: "500",
    titles: answer,
  });

  const pages = data?.query?.pages;
  if (!pages) {
    cacheSet(key, { exists: false });
    return { exists: false };
  }

  const page = Object.values(pages)[0];
  if (!page || page.missing) {
    cacheSet(key, { exists: false });
    return { exists: false };
  }

  const title = page.title;
  const wikibaseItem = page.pageprops?.wikibase_item || null;
  const categories = (page.categories || [])
    .map((c) => (c.title || "").replace(/^Category:/, ""))
    .filter(Boolean);

  const result = { exists: true, title, wikibaseItem, categories };
  cacheSet(key, result);
  return result;
}

async function getWikidataInstanceOf(qid) {
  if (!qid) return [];

  const key = `wd:${qid}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // Pull only claims; we only need P31 values (instance of)
  const data = await wikidataFetch({
    action: "wbgetentities",
    format: "json",
    ids: qid,
    props: "claims",
  });

  const ent = data?.entities?.[qid];
  const claims = ent?.claims;
  const p31 = claims?.P31 || [];

  const instanceOf = p31
    .map((snak) => snak?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

  cacheSet(key, instanceOf);
  return instanceOf;
}

// Category rules:
// 1) Prefer Wikidata P31 (instance of) matching known types
// 2) Fallback to Wikipedia categories keyword match
const CAT_RULES = {
  Country: {
    // country / sovereign state / nation state-ish
    p31AnyOf: new Set([
      "Q6256", // country
      "Q3624078", // sovereign state
      "Q7275", // state
      "Q3024240", // former country (still "real", but you can remove if you want)
      "Q15634554", // constituent country
    ]),
    catKeywords: ["countries", "sovereign states", "states", "nations"],
  },
  City: {
    p31AnyOf: new Set([
      "Q515", // city
      "Q3957", // town
      "Q1549591", // big city
      "Q15284", // municipality
      "Q1637706", // capital city
      "Q7930989", // urban area
    ]),
    catKeywords: ["cities", "towns", "municipalities", "capitals", "populated places", "villages"],
  },
  Animal: {
    // taxon/species/etc
    p31AnyOf: new Set([
      "Q16521", // taxon
      "Q7432", // species
      "Q68947", // subspecies
      "Q23038290", // fossil taxon
      "Q55983715", // animal (sometimes used)
    ]),
    catKeywords: ["animals", "fauna", "species", "genera", "mammals", "birds", "fish", "reptiles", "amphibians", "insects"],
  },
  Food: {
    p31AnyOf: new Set([
      "Q2095", // food
      "Q746549", // dish (commonly used; if this ID ever changes, fallback still works)
      "Q13233", // beverage
      "Q19861951", // food ingredient (sometimes)
    ]),
    catKeywords: ["foods", "food", "dishes", "cuisine", "beverages", "drinks", "desserts", "recipes"],
  },
  Celebrity: {
    // human
    p31AnyOf: new Set([
      "Q5", // human
    ]),
    // fallback categories are weak here; Wikipedia existence + human is usually OK
    catKeywords: ["people", "actors", "actresses", "singers", "musicians", "politicians", "writers", "athletes", "models"],
  },
  Brand: {
    p31AnyOf: new Set([
      "Q431289", // brand
      "Q4830453", // business
      "Q6881511", // enterprise
      "Q167270", // trademark
      "Q783794", // company
      "Q43229", // organization
      "Q2424752", // product
    ]),
    catKeywords: ["brands", "companies", "products", "trademarks", "manufacturers", "retailers", "corporations"],
  },
  Object: {
    // physical object / product / device / tool etc
    p31AnyOf: new Set([
      "Q223557", // physical object
      "Q2424752", // product
      "Q39546", // tool
      "Q1183543", // device
      "Q8205328", // artificial physical object
    ]),
    catKeywords: ["objects", "tools", "devices", "equipment", "inventions", "household", "furniture", "electronics"],
  },
};

function keywordMatch(categories, keywords) {
  if (!categories?.length || !keywords?.length) return false;
  const hay = categories.join(" ").toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function categoryMatch(cat, instanceOfIds, categories) {
  const rules = CAT_RULES[cat];
  if (!rules) return false;

  if (instanceOfIds?.length) {
    for (const id of instanceOfIds) {
      if (rules.p31AnyOf?.has(id)) return true;
    }
  }

  // fallback using Wikipedia categories keywords
  return keywordMatch(categories, rules.catKeywords);
}

async function validateOne(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);

  if (!answer) return { valid: false, reason: "Empty" };
  if (!startsWithLetter(answer, letter)) return { valid: false, reason: `Does not start with "${letter}"` };
  if (isObviouslyGibberish(answer)) return { valid: false, reason: "Looks like gibberish" };

  const page = await resolveWikipediaPage(answer);
  if (!page.exists) return { valid: false, reason: "No matching English Wikipedia page" };

  let instanceOf = [];
  if (page.wikibaseItem) {
    try {
      instanceOf = await getWikidataInstanceOf(page.wikibaseItem);
    } catch {
      // ignore; fallback to category keywords below
      instanceOf = [];
    }
  }

  const ok = categoryMatch(cat, instanceOf, page.categories);

  if (!ok) {
    return {
      valid: false,
      reason: `Wikipedia page exists ("${page.title}") but does not match category "${cat}"`,
    };
  }

  return { valid: true, reason: `Wikipedia-verified (${page.title})` };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { answers, letter } = req.body || {};
    if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

    const result = {};
    // Validate sequentially to be gentle with Wikimedia rate limits
    for (const cat of CATS) {
      result[cat] = await validateOne(cat, answers[cat] || "", letter);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("validate.js error:", err);
    // Strict fallback: only pass if answer is at least 3 chars and starts with letter
    const { answers, letter } = req.body || {};
    const fallback = {};
    CATS.forEach((c) => {
      const v = normAnswer((answers || {})[c] || "");
      const ok = v.length >= 3 && startsWithLetter(v, letter || "");
      fallback[c] = { valid: ok, reason: ok ? "Starts with letter (fallback)" : "Invalid (fallback)" };
    });
    return res.status(200).json(fallback);
  }
}
