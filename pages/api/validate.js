// validate.js — Wikipedia + Wikidata validation, supports Hebrew and English

const CATS = ["Country", "City", "Animal", "Food", "Celebrity", "Brand", "Object"];

const WIKI_API_EN = "https://en.wikipedia.org/w/api.php";
const WIKI_API_HE = "https://he.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const UA =
  process.env.WIKIMEDIA_USER_AGENT ||
  "AlphabetGameValidator/1.3 (https://www.alphabetush.com/)";

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
  return answer.trim().startsWith(letter.trim());
}

function isObviouslyGibberish(answer) {
  const a = answer.trim();
  if (a.length < 2) return true;
  if (/^(.)\1+$/u.test(a)) return true;
  if (a.length <= 5 && /^(.)\1{2,}/u.test(a)) return true;
  // Must have some letters (latin or Hebrew)
  const letters = (a.match(/[A-Za-zא-ת]/gu) || []).length;
  if (letters === 0) return true;
  if (letters / a.length < 0.4) return true;
  // No vowels check only for Latin (Hebrew has no vowel letters)
  const isHebrew = /[א-ת]/.test(a);
  if (!isHebrew) {
    const vowels = (a.match(/[aeiou]/gi) || []).length;
    if (a.length >= 3 && vowels === 0 && !/^[A-Z]{1,3}$/i.test(a)) return true;
  }
  return false;
}

async function wikiFetch(params, lang = "en") {
  const base = lang === "he" ? WIKI_API_HE : WIKI_API_EN;
  const url = new URL(base);
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

async function resolveWikipediaPage(title, lang = "en") {
  const key = `wp:${lang}:${title.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query", format: "json", redirects: "1",
    prop: "pageprops|categories", cllimit: "500", titles: title,
  }, lang);

  const pages = data?.query?.pages;
  if (!pages) { cacheSet(key, { exists: false }); return { exists: false }; }

  const page = Object.values(pages)[0];
  if (!page || page.missing) { cacheSet(key, { exists: false }); return { exists: false }; }

  const resolved = {
    exists: true,
    title: page.title,
    wikibaseItem: page.pageprops?.wikibase_item || null,
    categories: (page.categories || [])
      .map(c => (c.title || "").replace(/^(Category|קטגוריה):/, ""))
      .filter(Boolean),
  };
  cacheSet(key, resolved);
  return resolved;
}

async function wikipediaSearchTitles(query, lang = "en", limit = 8) {
  const key = `wps:${lang}:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "query", format: "json", list: "search",
    srlimit: String(limit), srsearch: query,
  }, lang);

  const titles = (data?.query?.search || []).map(r => r.title).filter(Boolean);
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
  const instanceOf = p31.map(snak => snak?.mainsnak?.datavalue?.value?.id).filter(Boolean);
  cacheSet(key, instanceOf);
  return instanceOf;
}

function keywordMatch(categories, keywords) {
  if (!categories?.length || !keywords?.length) return false;
  const hay = categories.join(" ").toLowerCase();
  return keywords.some(k => hay.includes(k.toLowerCase()));
}
function isDisambiguationTitle(t) {
  return /\(disambiguation\)|\(פירושונים\)/i.test(t || "");
}

// English category rules
const CAT_RULES_EN = {
  Country: {
    p31AnyOf: new Set(["Q6256","Q3624078","Q7275","Q3024240","Q15634554"]),
    catKeywords: ["countries","sovereign states","states","nations"],
  },
  City: {
    p31AnyOf: new Set(["Q515","Q3957","Q1549591","Q15284","Q1637706","Q7930989"]),
    catKeywords: ["cities","towns","municipalities","capitals","populated places","villages"],
  },
  Animal: {
    p31AnyOf: new Set(["Q16521","Q7432","Q68947","Q23038290","Q55983715"]),
    catKeywords: ["animals","fauna","species","genera","mammals","birds","fish","reptiles","amphibians","insects"],
  },
  Food: {
    p31AnyOf: new Set(["Q2095","Q746549","Q13233","Q19861951","Q11004","Q1364","Q12140","Q8502","Q16521"]),
    catKeywords: ["foods","food","dishes","cuisine","beverages","drinks","desserts","recipes","edible","vegetables","fruits","crops","plants used as food","culinary","snack foods","fast food"],
  },
  Celebrity: {
    p31AnyOf: new Set(["Q5"]),
    catKeywords: ["people","actors","actresses","singers","musicians","politicians","writers","athletes","models"],
  },
  Brand: {
    p31AnyOf: new Set(["Q431289","Q783794","Q4830453","Q6881511","Q43229","Q167270","Q2424752"]),
    catKeywords: ["brands","companies","products","trademarks","manufacturers","retailers","corporations","fashion houses","fashion brands","clothing brands","luxury brands","sportswear brands"],
  },
  Object: {
    p31AnyOf: new Set(["Q223557","Q8205328","Q2424752","Q39546","Q1183543","Q11460"]),
    catKeywords: ["objects","tools","devices","equipment","inventions","household","furniture","rooms","interior","architecture","building","construction","containers","storage","packaging","geology","rocks","minerals","musical notation","writing","stationery"],
  },
  Sport: {
    p31AnyOf: new Set(["Q349","Q2736","Q31629"]),
    catKeywords: ["sports","sport","games","athletics","martial arts","olympic"],
  },
  Movie: {
    p31AnyOf: new Set(["Q11424","Q24869","Q506240","Q1261214"]),
    catKeywords: ["films","movies","film","cinema","animated film"],
  },
  Vegetable: {
    p31AnyOf: new Set(["Q11004","Q16521"]),
    catKeywords: ["vegetables","vegetable","root vegetables","leaf vegetables","edible plants","crops"],
  },
  Fruit: {
    p31AnyOf: new Set(["Q1364","Q16521"]),
    catKeywords: ["fruits","fruit","berries","citrus","tropical fruits","edible"],
  },
  Name: {
    p31AnyOf: new Set(["Q202444","Q11879590","Q3409032"]),
    catKeywords: ["given names","first names","masculine given names","feminine given names","names"],
  },
  Car: {
    p31AnyOf: new Set(["Q3231690","Q9415","Q39495","Q1361017"]),
    catKeywords: ["cars","automobiles","vehicles","motor vehicles","car models","automotive"],
  },
  Color: {
    p31AnyOf: new Set(["Q1075","Q4082790"]),
    catKeywords: ["colors","colour","shades","hues","pigments"],
  },
  Flower: {
    p31AnyOf: new Set(["Q16521","Q506"]),
    catKeywords: ["flowers","flowering plants","ornamental plants","garden plants","flora"],
  },
  Instrument: {
    p31AnyOf: new Set(["Q34379","Q163829"]),
    catKeywords: ["musical instruments","instruments","percussion","string instruments","wind instruments","keyboard instruments"],
  },
  Profession: {
    p31AnyOf: new Set(["Q28640","Q12737077"]),
    catKeywords: ["occupations","professions","jobs","careers","trades","vocations"],
  },
  River: {
    p31AnyOf: new Set(["Q4022","Q55659167"]),
    catKeywords: ["rivers","streams","waterways","tributaries"],
  },
  Language: {
    p31AnyOf: new Set(["Q34770","Q1288568","Q33742"]),
    catKeywords: ["languages","dialects","natural languages","language families"],
  },
  Clothing: {
    p31AnyOf: new Set(["Q11460","Q2483509","Q3241045"]),
    catKeywords: ["clothing","garments","fashion","apparel","footwear","accessories","costume"],
  },
};

const CAT_RULES_HE = {
  Country:    { catKeywords: ["מדינות","מדינה","ארצות","ריבוניות","לאומים"] },
  City:       { catKeywords: ["ערים","עיר","עירייה","מוניציפליות","עיירות","יישובים","בירות"] },
  Animal:     { catKeywords: ["בעלי חיים","יונקים","עופות","דגים","זוחלים","חרקים","מינים","חיות"] },
  Food:       { catKeywords: ["מזון","אוכל","מטבח","משקאות","ירקות","פירות","תזונה","מאכל","מנות","חטיפים"] },
  Celebrity:  { catKeywords: ["שחקנים","זמרים","מוזיקאים","ספורטאים","פוליטיקאים","סופרים","אנשים","ידוענים"] },
  Brand:      { catKeywords: ["מותגים","חברות","תאגידים","יצרנים","קמעונאים","מוצרים","סימני מסחר"] },
  Object:     { catKeywords: ["כלים","מכשירים","ציוד","רהיטים","חפצים","מיכלים","סלעים","מינרלים","אדריכלות","כלי נגינה"] },
  Sport:      { catKeywords: ["ספורט","ענפי ספורט","משחקים","אתלטיקה","אולימפי","כדורגל","כדורסל"] },
  Movie:      { catKeywords: ["סרטים","סרט","קולנוע","אנימציה","קומדיה","דרמה","בימוי"] },
  Vegetable:  { catKeywords: ["ירקות","ירק","צמחים אכילים","גידולים","ירקות שורש","ירקות עלים"] },
  Fruit:      { catKeywords: ["פירות","פרי","פירות הדר","פירות טרופיים","פירות יער","גידולים"] },
  Name:       { catKeywords: ["שמות פרטיים","שמות","שם פרטי","שמות גבריים","שמות נשיים"] },
  Car:        { catKeywords: ["מכוניות","רכבים","אוטומובילים","דגמי רכב","תעשיית הרכב"] },
  Color:      { catKeywords: ["צבעים","צבע","גוונים","פיגמנטים","גוון","צבעוני"] },
  Flower:     { catKeywords: ["פרחים","פרח","צמחי נוי","גינון","צמחיה","פריחה"] },
  Instrument: { catKeywords: ["כלי נגינה","כלים","מוזיקה","פריטה","נגינה","כלי הקשה","כלי מיתר","כלי נשיפה"] },
  Profession: { catKeywords: ["מקצועות","מקצוע","עיסוקים","קריירה","עבודה","תפקידים"] },
  River:      { catKeywords: ["נהרות","נהר","זרמים","מים","גאוגרפיה","אגן ניקוז"] },
  Language:   { catKeywords: ["שפות","שפה","ניבים","לשון","שפות טבעיות","משפחות לשון"] },
  Clothing:   { catKeywords: ["ביגוד","בגדים","אופנה","לבוש","הלבשה","נעליים","אקססוריז"] },
};

const WRONG_TYPE_P31 = { human:"Q5", city:"Q515", country:"Q6256", org:"Q43229", company:"Q783794" };
const OBJECT_WHITELIST_EN = new Set(["table","room","rock","note","crate"]);
const FOOD_WHITELIST_EN   = new Set(["rambutan","apple","nuggets","chips"]);

const SEARCH_HINTS_EN = {
  Brand:      ["brand","company","inc","corporation"],
  Celebrity:  ["actor","actress","singer","musician","comedian","athlete","writer"],
  Food:       ["food","dish","fruit","vegetable","snack","fast food"],
  City:       ["city","town","municipality","Iowa","South Carolina","West Virginia"],
  Object:     ["object","furniture","container","geology","music","notation"],
  Sport:      ["sport","game","athletics","martial art","olympic sport"],
  Movie:      ["film","movie","animated","comedy","drama"],
  Vegetable:  ["vegetable","plant","crop","root","leaf"],
  Fruit:      ["fruit","berry","citrus","tropical"],
  Name:       ["given name","first name","masculine name","feminine name"],
  Car:        ["car","automobile","vehicle","model","automotive"],
  Color:      ["color","colour","shade","hue","pigment"],
  Flower:     ["flower","plant","bloom","garden","flora"],
  Instrument: ["instrument","musical","percussion","string","wind","keyboard"],
  Profession: ["occupation","profession","job","career","trade"],
  River:      ["river","stream","waterway","tributary"],
  Language:   ["language","dialect","tongue","linguistic"],
  Clothing:   ["clothing","garment","fashion","apparel","footwear"],
};

const SEARCH_HINTS_HE = {
  Brand:      ["חברה","מותג","תאגיד"],
  Celebrity:  ["שחקן","זמר","מוזיקאי","ספורטאי","פוליטיקאי"],
  Food:       ["מזון","פרי","ירק","מאכל"],
  City:       ["עיר","עיירה","יישוב"],
  Object:     ["חפץ","כלי","ריהוט","סלע"],
  Sport:      ["ספורט","משחק","אתלטיקה"],
  Movie:      ["סרט","קולנוע","בימוי"],
  Vegetable:  ["ירק","צמח","גידול"],
  Fruit:      ["פרי","הדר","טרופי"],
  Name:       ["שם","פרטי"],
  Car:        ["מכונית","רכב","דגם"],
  Color:      ["צבע","גוון"],
  Flower:     ["פרח","צמח","גינה"],
  Instrument: ["כלי נגינה","מוזיקה","נגינה"],
  Profession: ["מקצוע","עיסוק","עבודה"],
  River:      ["נהר","מים","זרם"],
  Language:   ["שפה","לשון","ניב"],
  Clothing:   ["בגד","ביגוד","לבוש"],
};

function categoryMatchEN(cat, instanceOfIds, categories, answerLower) {
  const rules = CAT_RULES_EN[cat];
  if (!rules) return false;

  const ids = instanceOfIds || [];

  // For these categories, if the page is clearly a human/city/country — reject
  const strictCats = ["Flower","Clothing","Instrument","Sport","Movie","Vegetable","Fruit","Car","Color","River","Language","Profession","Name"];
  if (strictCats.includes(cat)) {
    if (ids.includes(WRONG_TYPE_P31.human) && cat !== "Name") return false;
    if (ids.includes(WRONG_TYPE_P31.city)) return false;
    if (ids.includes(WRONG_TYPE_P31.country)) return false;
    // Must match either P31 or category keywords — not just any page
    const p31Match = ids.some(id => rules.p31AnyOf?.has(id));
    const catMatch = keywordMatch(categories, rules.catKeywords);
    return p31Match || catMatch;
  }

  if (cat === "Food") {
    const isTaxon = ids.includes("Q16521");
    const hasFoodCats = keywordMatch(categories, rules.catKeywords);
    const p31DirectFood = ids.some(id => id !== "Q16521" && rules.p31AnyOf.has(id));
    if (p31DirectFood) return true;
    if (FOOD_WHITELIST_EN.has(answerLower)) return hasFoodCats;
    if (isTaxon) return hasFoodCats;
    return hasFoodCats;
  }

  if (cat === "Object" && OBJECT_WHITELIST_EN.has(answerLower)) {
    if (ids.includes(WRONG_TYPE_P31.human)) return false;
    if (ids.includes(WRONG_TYPE_P31.company) || ids.includes(WRONG_TYPE_P31.org)) return false;
    if (ids.includes(WRONG_TYPE_P31.city) || ids.includes(WRONG_TYPE_P31.country)) return false;
    return true;
  }

  if (cat === "Brand") {
    if (ids.includes(WRONG_TYPE_P31.human)) {
      if (!keywordMatch(categories, rules.catKeywords)) return false;
    }
  }
  if (cat === "Celebrity") {
    const isHuman = ids.includes(WRONG_TYPE_P31.human);
    if (!isHuman && !keywordMatch(categories, rules.catKeywords)) return false;
  }

  if (ids.length) {
    for (const id of ids) { if (rules.p31AnyOf?.has(id)) return true; }
  }
  return keywordMatch(categories, rules.catKeywords);
}

// Hebrew validation: use Wikidata P31 where available, then Hebrew Wikipedia categories
async function categoryMatchHE(cat, page) {
  if (!page.exists) return false;
  if (isDisambiguationTitle(page.title)) return false;

  const rules = CAT_RULES_HE[cat];
  if (!rules) return false;

  // Try Wikidata first (language-agnostic)
  let instanceOf = [];
  if (page.wikibaseItem) {
    try { instanceOf = await getWikidataInstanceOf(page.wikibaseItem); } catch {}
  }

  // Map English CAT_RULES P31 for Hebrew too
  const enRules = CAT_RULES_EN[cat];
  if (instanceOf.length && enRules?.p31AnyOf) {
    // Special handling same as English
    if (cat === "Celebrity") {
      if (instanceOf.includes(WRONG_TYPE_P31.human)) return true;
    }
    if (cat === "Brand") {
      if (instanceOf.includes(WRONG_TYPE_P31.human)) {
        return keywordMatch(page.categories, rules.catKeywords);
      }
    }
    for (const id of instanceOf) {
      if (enRules.p31AnyOf.has(id)) return true;
    }
  }

  // Fall back to Hebrew category keywords
  return keywordMatch(page.categories, rules.catKeywords);
}

async function validateOneEN(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);
  const answerLower = answer.toLowerCase();

  if (!answer)                            return { valid: false, reason: "Empty" };
  if (!startsWithLetter(answer, letter))  return { valid: false, reason: `Does not start with "${letter}"` };
  if (isObviouslyGibberish(answer))       return { valid: false, reason: "Looks like gibberish" };

  // Direct lookup
  const direct = await resolveWikipediaPage(answer, "en");
  if (direct.exists) {
    let instanceOf = [];
    if (direct.wikibaseItem) try { instanceOf = await getWikidataInstanceOf(direct.wikibaseItem); } catch {}
    if (!isDisambiguationTitle(direct.title) && categoryMatchEN(cat, instanceOf, direct.categories, answerLower)) {
      return { valid: true, reason: `Wikipedia-verified (${direct.title})` };
    }
  }

  // Search fallback
  const hintWords = SEARCH_HINTS_EN[cat] || [];
  const queries = [answer, ...hintWords.slice(0,3).map(h => `${answer} ${h}`)];
  const seen = new Set();
  for (const q of queries) {
    if (seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    const candidates = await wikipediaSearchTitles(q, "en", 8);
    for (const t of candidates) {
      const p = await resolveWikipediaPage(t, "en");
      if (!p.exists || isDisambiguationTitle(p.title)) continue;
      let instanceOf = [];
      if (p.wikibaseItem) try { instanceOf = await getWikidataInstanceOf(p.wikibaseItem); } catch {}
      if (categoryMatchEN(cat, instanceOf, p.categories, answerLower)) {
        return { valid: true, reason: `Wikipedia-verified (${p.title})` };
      }
    }
  }

  if (!direct.exists) return { valid: false, reason: "No matching Wikipedia page found" };
  return { valid: false, reason: `"${direct.title}" does not match category "${cat}"` };
}

async function validateOneHE(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);

  if (!answer)                            return { valid: false, reason: "ריק" };
  if (!startsWithLetter(answer, letter))  return { valid: false, reason: `לא מתחיל ב-"${letter}"` };
  if (isObviouslyGibberish(answer))       return { valid: false, reason: "נראה כמו ג'יבריש" };

  // 1) Direct Hebrew Wikipedia lookup
  const direct = await resolveWikipediaPage(answer, "he");
  if (direct.exists && !isDisambiguationTitle(direct.title)) {
    if (await categoryMatchHE(cat, direct)) {
      return { valid: true, reason: `אומת בויקיפדיה (${direct.title})` };
    }
  }

  // 2) Search Hebrew Wikipedia
  const hintWords = SEARCH_HINTS_HE[cat] || [];
  const queries = [answer, ...hintWords.slice(0,2).map(h => `${answer} ${h}`)];
  const seen = new Set();
  for (const q of queries) {
    if (seen.has(q)) continue;
    seen.add(q);
    const candidates = await wikipediaSearchTitles(q, "he", 8);
    for (const t of candidates) {
      const p = await resolveWikipediaPage(t, "he");
      if (!p.exists || isDisambiguationTitle(p.title)) continue;
      if (await categoryMatchHE(cat, p)) {
        return { valid: true, reason: `אומת בויקיפדיה (${p.title})` };
      }
    }
  }

  if (!direct.exists) return { valid: false, reason: "לא נמצא דף ויקיפדיה תואם" };
  return { valid: false, reason: `"${direct.title}" לא תואם לקטגוריה "${cat}"` };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    const { answers, letter, lang, cats } = req.body || {};
    if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

    const isHebrew = lang === "he";
    const result = {};

    // Use dynamic cats from request, fallback to defaults
    const activeCats = Array.isArray(cats) && cats.length > 0 ? cats : CATS;

    for (const cat of activeCats) {
      const answer = normAnswer(answers[cat] || "");

      // Enforce minimum 3 characters (must be a real word, not just initials)
      if (answer.length < 3) {
        result[cat] = { valid: false, reason: isHebrew ? "תשובה קצרה מדי" : "Answer too short (min 3 letters)" };
        continue;
      }

      result[cat] = isHebrew
        ? await validateOneHE(cat, answer, letter)
        : await validateOneEN(cat, answer, letter);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("validate.js error:", err);
    const { answers, letter, cats } = req.body || {};
    const activeCats = Array.isArray(cats) && cats.length > 0 ? cats : CATS;
    const fallback = {};
    activeCats.forEach(c => {
      const v = normAnswer((answers||{})[c] || "");
      const ok = v.length >= 2 && startsWithLetter(v, letter || "");
      fallback[c] = { valid: ok, reason: ok ? "Valid (fallback)" : "Invalid (fallback)" };
    });
    return res.status(200).json(fallback);
  }
}
