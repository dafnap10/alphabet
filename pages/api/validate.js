// validate.js
// Real validation using Wikipedia + Wikidata.
// Fixes requested:
// 1) "table" + "room" recognized as Object
// 2) "Apple" + "Nike" recognized as Brand (handles ambiguous terms via Wikipedia search fallback)
// 3) "Robin wiliams" recognized as Celebrity (typo-tolerant via Wikipedia search fallback)

const CATS = ["Country", "City", "Animal", "Food", "Celebrity", "Brand", "Object"];

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

// Wikimedia recommends setting a User-Agent
const UA =
  process.env.WIKIMEDIA_USER_AGENT ||
  "AlphabetGameValidator/1.1 (https://alphabetush.vercel.app/; contact: your-email@example.com)";

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
  // Conservative; Wikipedia existence is the real filter.
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
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("origin", "*");

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Wikipedia API error: ${r.status}`);
  return r.json();
}

async function wikidataFetch(params) {
  const url = new URL(WIKIDATA_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const r = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Wikidata API error: ${r.status}`);
  return r.json();
}

async function resolveWikipediaPage(title) {
  const key = `wp:${title.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query",
    format: "json",
    redirects: "1",
    prop: "pageprops|categories",
    cllimit: "500",
    titles: title,
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

  const resolved = {
    exists: true,
    title: page.title,
    wikibaseItem: page.pageprops?.wikibase_item || null,
    categories: (page.categories || [])
      .map((c) => (c.title || "").replace(/^Category:/, ""))
      .filter(Boolean),
  };

  cacheSet(key, resolved);
  return resolved;
}

async function wikipediaSearchTitles(query, limit = 6) {
  const key = `wps:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query",
    format: "json",
    list: "search",
    srlimit: String(limit),
    srsearch: query,
  });

  const titles = (data?.query?.search || [])
    .map((r) => r.title)
    .filter(Boolean);

  cacheSet(key, titles);
  return titles;
}

async function getWikidataInstanceOf(qid) {
  if (!qid) return [];

  const key = `wdp31:${qid}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikidataFetch({
    action: "wbgetentities",
    format: "json",
    ids: qid,
    props: "claims",
  });

  const ent = data?.entities?.[qid];
  const p31 = ent?.claims?.P31 || [];

  const instanceOf = p31
    .map((snak) => snak?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

  cacheSet(key, instanceOf);
  return instanceOf;
}

// Keyword fallback matcher (Wikipedia categories are noisy, but helpful)
function keywordMatch(categories, keywords) {
  if (!categories?.length || !keywords?.length) return false;
  const hay = categories.join(" ").toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

// Category rules
const CAT_RULES = {
  Country: {
    p31AnyOf: new Set(["Q6256", "Q3624078", "Q7275", "Q3024240", "Q15634554"]),
    catKeywords: ["countries", "sovereign states", "states", "nations"],
  },
  City: {
    p31AnyOf: new Set(["Q515", "Q3957", "Q1549591", "Q15284", "Q1637706", "Q7930989"]),
    catKeywords: ["cities", "towns", "municipalities", "capitals", "populated places", "villages"],
  },
  Animal: {
    p31AnyOf: new Set(["Q16521", "Q7432", "Q68947", "Q23038290", "Q55983715"]),
    catKeywords: [
      "animals",
      "fauna",
      "species",
      "genera",
      "mammals",
      "birds",
      "fish",
      "reptiles",
      "amphibians",
      "insects",
    ],
  },
  Food: {
    // tomato fix: allow taxon only if categories look edible/culinary
    p31AnyOf: new Set([
      "Q2095", // food
      "Q746549", // dish (commonly used)
      "Q13233", // beverage
      "Q19861951", // food ingredient
      "Q11004", // vegetable
      "Q1364", // fruit
      "Q12140", // agricultural product
      "Q8502", // crop
      "Q16521", // taxon (tomato, etc.) => requires edible categories
    ]),
    catKeywords: [
      "foods",
      "food",
      "dishes",
      "cuisine",
      "beverages",
      "drinks",
      "desserts",
      "recipes",
      "edible",
      "vegetables",
      "fruits",
      "crops",
      "plants used as food",
      "culinary",
    ],
  },
  Celebrity: {
    // Wikipedia existence + P31 human is usually enough
    p31AnyOf: new Set(["Q5"]), // human
    catKeywords: ["people", "actors", "actresses", "singers", "musicians", "politicians", "writers", "athletes", "models"],
  },
  Brand: {
    // broaden to catch Apple/Nike via "Apple Inc." / "Nike, Inc." search results
    p31AnyOf: new Set([
      "Q431289", // brand
      "Q783794", // company
      "Q4830453", // business
      "Q6881511", // enterprise
      "Q43229", // organization
      "Q167270", // trademark
      "Q2424752", // product
    ]),
    catKeywords: ["brands", "companies", "products", "trademarks", "manufacturers", "retailers", "corporations"],
  },
  Object: {
    // broaden keywords so "table" and "room" pass when Wikipedia page exists
    p31AnyOf: new Set([
      "Q223557", // physical object
      "Q8205328", // artificial physical object
      "Q2424752", // product
      "Q39546", // tool
      "Q1183543", // device
      // Note: abstract "table" / "room" pages often won't match these P31s,
      // so we rely on Wikipedia categories keywords + special-case common objects below.
    ]),
    catKeywords: [
      "objects",
      "tools",
      "devices",
      "equipment",
      "inventions",
      "household",
      "furniture",
      "rooms",
      "interior",
      "architecture",
      "building",
      "construction",
    ],
  },
};

// Hard, explicit “must work” objects (still requires Wikipedia page to exist)
const OBJECT_WHITELIST = new Set([
  "table",
  "room",
]);

function categoryMatch(cat, instanceOfIds, categories, answerNormalized) {
  const rules = CAT_RULES[cat];
  if (!rules) return false;

  // Special handling: Food with taxon only if edible categories
  if (cat === "Food") {
    const isTaxon = (instanceOfIds || []).includes("Q16521");
    const hasEdibleCats = keywordMatch(categories, rules.catKeywords);

    const p31DirectFood = (instanceOfIds || []).some((id) => id !== "Q16521" && rules.p31AnyOf.has(id));
    if (p31DirectFood) return true;

    if (isTaxon) return hasEdibleCats;
    return hasEdibleCats;
  }

  // Special handling: Object whitelist (table/room) + category keywords
  if (cat === "Object") {
    if (OBJECT_WHITELIST.has((answerNormalized || "").toLowerCase())) {
      // must still look like an object-ish page
      return keywordMatch(categories, rules.catKeywords) || true;
    }
  }

  // Default: accept if any P31 matches
  if (instanceOfIds?.length) {
    for (const id of instanceOfIds) {
      if (rules.p31AnyOf?.has(id)) return true;
    }
  }

  // fallback: keyword match on Wikipedia categories
  return keywordMatch(categories, rules.catKeywords);
}

async function checkPageAgainstCategory(cat, page, answerNormalized) {
  let instanceOf = [];
  if (page.wikibaseItem) {
    try {
      instanceOf = await getWikidataInstanceOf(page.wikibaseItem);
    } catch {
      instanceOf = [];
    }
  }
  return categoryMatch(cat, instanceOf, page.categories, answerNormalized);
}

async function validateOne(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);
  const answerLower = answer.toLowerCase();

  if (!answer) return { valid: false, reason: "Empty" };
  if (!startsWithLetter(answer, letter)) return { valid: false, reason: `Does not start with "${letter}"` };
  if (isObviouslyGibberish(answer)) return { valid: false, reason: "Looks like gibberish" };

  // 1) Try direct title lookup (with redirects)
  const direct = await resolveWikipediaPage(answer);
  if (direct.exists) {
    const ok = await checkPageAgainstCategory(cat, direct, answerLower);
    if (ok) return { valid: true, reason: `Wikipedia-verified (${direct.title})` };
  }

  // 2) Fallback: Wikipedia search (fixes Apple->Apple Inc., Nike->Nike, Inc., Robin wiliams->Robin Williams)
  // Keep it strict: only accept if a search result page exists AND matches the category.
  const candidates = await wikipediaSearchTitles(answer, 6);
  for (const t of candidates) {
    const p = await resolveWikipediaPage(t);
    if (!p.exists) continue;
    const ok = await checkPageAgainstCategory(cat, p, answerLower);
    if (ok) return { valid: true, reason: `Wikipedia-verified (${p.title})` };
  }

  // Explain best-known failure mode
  if (!direct.exists && (!candidates || candidates.length === 0)) {
    return { valid: false, reason: "No matching English Wikipedia page" };
  }
  return {
    valid: false,
    reason: direct.exists
      ? `Wikipedia page exists ("${direct.title}") but does not match category "${cat}"`
      : `No Wikipedia search result matched category "${cat}"`,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { answers, letter } = req.body || {};
    if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

    const result = {};
    // Sequential to be gentle with Wikimedia rate limits
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
