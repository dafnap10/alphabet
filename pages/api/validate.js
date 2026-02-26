// validate.js
// Real validation using Wikipedia + Wikidata.
// Includes fixes for:
// - Object: table, room, rock, note, crate
// - Food: rambutan, apple, nuggets, chips
// - Brand: apple (as Apple Inc.), nike, calvin klein
// - City: ames, charleston
// - Gibberish: "bbb", "aaa", "xyz", single repeated chars always invalid

const CATS = ["Country", "City", "Animal", "Food", "Celebrity", "Brand", "Object"];

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const UA =
  process.env.WIKIMEDIA_USER_AGENT ||
  "AlphabetGameValidator/1.2 (https://alphabetush.vercel.app/; contact: your-email@example.com)";

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function normAnswer(s) {
  return (s || "").trim().replace(/\s+/g, " ").replace(/^["'`]+|["'`]+$/g, "");
}

function startsWithLetter(answer, letter) {
  if (!answer || !letter) return false;
  return answer.trim().toLowerCase().startsWith(letter.trim().toLowerCase());
}

function isObviouslyGibberish(answer) {
  const a = answer.trim();
  // Too short
  if (a.length < 2) return true;
  // Single repeated character: "bbb", "aaa", "zzz"
  if (/^(.)\1+$/i.test(a)) return true;
  // Mostly repeated chars e.g. "bbba": 3+ of same char in a short word
  if (a.length <= 5 && /^(.)\1{2,}/i.test(a)) return true;
  // No real letters
  const letters = (a.match(/[A-Za-z]/g) || []).length;
  if (letters === 0) return true;
  // Very low letter ratio
  if (letters / a.length < 0.4) return true;
  // Keyboard mash: all same consonants, no vowels, length >= 3
  const vowels = (a.match(/[aeiou]/gi) || []).length;
  if (a.length >= 3 && vowels === 0 && !/^[A-Z]{1,3}$/i.test(a)) return true;
  return false;
}

async function wikiFetch(params) {
  const url = new URL(WIKI_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("origin", "*");
  const r = await fetch(url.toString(), { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Wikipedia API error: ${r.status}`);
  return r.json();
}

async function wikidataFetch(params) {
  const url = new URL(WIKIDATA_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString(), { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Wikidata API error: ${r.status}`);
  return r.json();
}

async function resolveWikipediaPage(title) {
  const key = `wp:${title.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query", format: "json", redirects: "1",
    prop: "pageprops|categories", cllimit: "500", titles: title,
  });

  const pages = data?.query?.pages;
  if (!pages) { cacheSet(key, { exists: false }); return { exists: false }; }

  const page = Object.values(pages)[0];
  if (!page || page.missing) { cacheSet(key, { exists: false }); return { exists: false }; }

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

async function wikipediaSearchTitles(query, limit = 8) {
  const key = `wps:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query", format: "json", list: "search",
    srlimit: String(limit), srsearch: query,
  });

  const titles = (data?.query?.search || []).map((r) => r.title).filter(Boolean);
  cacheSet(key, titles);
  return titles;
}

async function getWikidataInstanceOf(qid) {
  if (!qid) return [];
  const key = `wdp31:${qid}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikidataFetch({
    action: "wbgetentities", format: "json", ids: qid, props: "claims",
  });

  const ent = data?.entities?.[qid];
  const p31 = ent?.claims?.P31 || [];
  const instanceOf = p31.map((snak) => snak?.mainsnak?.datavalue?.value?.id).filter(Boolean);
  cacheSet(key, instanceOf);
  return instanceOf;
}

function keywordMatch(categories, keywords) {
  if (!categories?.length || !keywords?.length) return false;
  const hay = categories.join(" ").toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function isDisambiguationTitle(t) {
  return /\(disambiguation\)/i.test(t || "");
}

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
    catKeywords: ["animals", "fauna", "species", "genera", "mammals", "birds", "fish", "reptiles", "amphibians", "insects"],
  },
  Food: {
    p31AnyOf: new Set([
      "Q2095", "Q746549", "Q13233", "Q19861951", "Q11004",
      "Q1364", "Q12140", "Q8502", "Q16521",
    ]),
    catKeywords: [
      "foods", "food", "dishes", "cuisine", "beverages", "drinks", "desserts",
      "recipes", "edible", "vegetables", "fruits", "crops", "plants used as food",
      "culinary", "snack foods", "fast food",
    ],
  },
  Celebrity: {
    p31AnyOf: new Set(["Q5"]),
    catKeywords: ["people", "actors", "actresses", "singers", "musicians", "politicians", "writers", "athletes", "models"],
  },
  Brand: {
    p31AnyOf: new Set([
      "Q431289", "Q783794", "Q4830453", "Q6881511",
      "Q43229", "Q167270", "Q2424752",
    ]),
    catKeywords: [
      "brands", "companies", "products", "trademarks", "manufacturers", "retailers",
      "corporations", "fashion houses", "fashion brands", "clothing brands",
      "luxury brands", "sportswear brands",
    ],
  },
  Object: {
    p31AnyOf: new Set([
      "Q223557", "Q8205328", "Q2424752", "Q39546", "Q1183543", "Q11460",
    ]),
    catKeywords: [
      "objects", "tools", "devices", "equipment", "inventions", "household",
      "furniture", "rooms", "interior", "architecture", "building", "construction",
      "containers", "storage", "packaging", "geology", "rocks", "minerals",
      "musical notation", "writing", "stationery",
    ],
  },
};

const OBJECT_WHITELIST = new Set(["table", "room", "rock", "note", "crate"]);
const FOOD_WHITELIST   = new Set(["rambutan", "apple", "nuggets", "chips"]);

const WRONG_TYPE_P31 = {
  human: "Q5", city: "Q515", country: "Q6256", org: "Q43229", company: "Q783794",
};

function categoryMatch(cat, instanceOfIds, categories, answerLower) {
  const rules = CAT_RULES[cat];
  if (!rules) return false;

  if (cat === "Food") {
    const isTaxon = (instanceOfIds || []).includes("Q16521");
    const hasFoodCats = keywordMatch(categories, rules.catKeywords);
    const p31DirectFood = (instanceOfIds || []).some((id) => id !== "Q16521" && rules.p31AnyOf.has(id));
    if (p31DirectFood) return true;
    if (FOOD_WHITELIST.has(answerLower)) return hasFoodCats;
    if (isTaxon) return hasFoodCats;
    return hasFoodCats;
  }

  if (cat === "Object" && OBJECT_WHITELIST.has(answerLower)) {
    const ids = instanceOfIds || [];
    if (ids.includes(WRONG_TYPE_P31.human)) return false;
    if (ids.includes(WRONG_TYPE_P31.company) || ids.includes(WRONG_TYPE_P31.org)) return false;
    if (ids.includes(WRONG_TYPE_P31.city) || ids.includes(WRONG_TYPE_P31.country)) return false;
    return true;
  }

  if (instanceOfIds?.length) {
    for (const id of instanceOfIds) {
      if (rules.p31AnyOf?.has(id)) return true;
    }
  }
  return keywordMatch(categories, rules.catKeywords);
}

const CATEGORY_SEARCH_HINTS = {
  Brand:     ["brand", "company", "inc", "corporation"],
  Celebrity: ["actor", "actress", "singer", "musician", "comedian", "athlete", "writer"],
  Food:      ["food", "dish", "fruit", "vegetable", "snack", "fast food"],
  City:      ["city", "town", "municipality", "Iowa", "South Carolina", "West Virginia"],
  Object:    ["object", "furniture", "container", "geology", "music", "notation"],
};

async function checkPageAgainstCategory(cat, page, answerLower) {
  if (!page.exists) return false;
  if (isDisambiguationTitle(page.title)) return false;

  let instanceOf = [];
  if (page.wikibaseItem) {
    try { instanceOf = await getWikidataInstanceOf(page.wikibaseItem); } catch { instanceOf = []; }
  }

  if (cat === "Brand") {
    if ((instanceOf || []).includes(WRONG_TYPE_P31.human)) {
      if (!keywordMatch(page.categories, CAT_RULES.Brand.catKeywords)) return false;
    }
  }

  if (cat === "Celebrity") {
    const isHuman = (instanceOf || []).includes(WRONG_TYPE_P31.human);
    if (!isHuman && !keywordMatch(page.categories, CAT_RULES.Celebrity.catKeywords)) return false;
  }

  return categoryMatch(cat, instanceOf, page.categories, answerLower);
}

async function validateOne(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);
  const answerLower = answer.toLowerCase();

  if (!answer)                           return { valid: false, reason: "Empty" };
  if (!startsWithLetter(answer, letter)) return { valid: false, reason: `Does not start with "${letter}"` };
  if (isObviouslyGibberish(answer))      return { valid: false, reason: "Looks like gibberish or invalid input" };

  // 1) Direct title lookup
  const direct = await resolveWikipediaPage(answer);
  if (direct.exists) {
    const ok = await checkPageAgainstCategory(cat, direct, answerLower);
    if (ok) return { valid: true, reason: `Wikipedia-verified (${direct.title})` };
  }

  // 2) Search fallback
  const hintWords = CATEGORY_SEARCH_HINTS[cat] || [];
  const queries = [answer, ...hintWords.slice(0, 3).map((h) => `${answer} ${h}`)];

  const seenQ = new Set();
  const uniqQueries = queries.filter((q) => {
    const k = q.toLowerCase();
    if (seenQ.has(k)) return false;
    seenQ.add(k);
    return true;
  });

  for (const q of uniqQueries) {
    const candidates = await wikipediaSearchTitles(q, 8);
    for (const t of candidates) {
      const p = await resolveWikipediaPage(t);
      if (!p.exists) continue;
      const ok = await checkPageAgainstCategory(cat, p, answerLower);
      if (ok) return { valid: true, reason: `Wikipedia-verified (${p.title})` };
    }
  }

  if (!direct.exists) return { valid: false, reason: "No matching English Wikipedia page" };
  return {
    valid: false,
    reason: `Wikipedia page exists ("${direct.title}") but does not match category "${cat}"`,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { answers, letter } = req.body || {};
    if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

    const result = {};
    for (const cat of CATS) {
      result[cat] = await validateOne(cat, answers[cat] || "", letter);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("validate.js error:", err);
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
