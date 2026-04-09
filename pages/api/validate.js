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
  return answer.trim().toLowerCase().startsWith(letter.trim().toLowerCase());
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

const FETCH_TIMEOUT_MS = 6000; // 6 seconds per request
const MAX_RETRIES = 2;

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return r;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const CAT_NAMES_HE = {
  Country: "מדינה", City: "עיר", Animal: "חיה", Food: "אוכל",
  Celebrity: "מפורסם", Brand: "מותג", Object: "חפץ", Sport: "ספורט",
  Movie: "סרט", Vegetable: "ירק", Fruit: "פרי", Name: "שם",
  Car: "רכב", Color: "צבע", Flower: "פרח", Instrument: "כלי נגינה",
  Profession: "מקצוע", River: "נהר", Language: "שפה", Clothing: "ביגוד"
};

async function wikiFetch(params, lang = "en") {
  const base = lang === "he" ? WIKI_API_HE : WIKI_API_EN;
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("origin", "*");
  let lastErr;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const r = await fetchWithTimeout(url.toString(), { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) throw new Error(`Wikipedia API error: ${r.status}`);
      return r.json();
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRIES - 1) await new Promise(res => setTimeout(res, 500));
    }
  }
  throw lastErr;
}

async function wikidataFetch(params) {
  const url = new URL(WIKIDATA_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  let lastErr;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const r = await fetchWithTimeout(url.toString(), { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) throw new Error(`Wikidata API error: ${r.status}`);
      return r.json();
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRIES - 1) await new Promise(res => setTimeout(res, 500));
    }
  }
  throw lastErr;
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
    originalTitle: title, // keep original search term for titleMatchesAnswer
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

  // P31 = instance of
  const p31 = ent?.claims?.P31 || [];
  const instanceOf = p31.map(snak => snak?.mainsnak?.datavalue?.value?.id).filter(Boolean);

  // P366 = has use (e.g. food, vegetable) — important for taxons like כרוב
  const p366 = ent?.claims?.P366 || [];
  const hasUse = p366.map(snak => snak?.mainsnak?.datavalue?.value?.id).filter(Boolean);

  // Combine — treat "has use: food/vegetable" as equivalent to "instance of food"
  const combined = [...new Set([...instanceOf, ...hasUse])];
  cacheSet(key, combined);
  return combined;
}

function keywordMatch(categories, keywords) {
  if (!categories?.length || !keywords?.length) return false;
  const hay = categories.join(" ").toLowerCase();
  return keywords.some(k => hay.includes(k.toLowerCase()));
}
function isDisambiguationTitle(t) {
  return /\(disambiguation\)|\(פירושונים\)/i.test(t || "");
}

// Maps category to disambiguation suffixes to try
const DISAMBIGUATION_HINTS = {
  Name:       ["שם פרטי", "שם", "given name"],
  Animal:     ["חיה", "בעל חיים", "species", "animal"],
  Food:       ["מאכל", "אוכל", "food", "dish"],
  Flower:     ["פרח", "צמח", "flower", "plant"],
  River:      ["נהר", "river"],
  City:       ["עיר", "city"],
  Country:    ["מדינה", "country"],
  Instrument: ["כלי נגינה", "instrument"],
  Clothing:   ["בגד", "clothing"],
  Color:      ["צבע", "color"],
};

async function resolveFromDisambiguation(answer, cat, lang) {
  const hints = DISAMBIGUATION_HINTS[cat] || [];
  if (!hints.length) return null;
  // Try "answer (hint)" for each hint
  for (const hint of hints) {
    const candidate = `${answer} (${hint})`;
    const page = await resolveWikipediaPage(candidate, lang);
    if (page.exists && !isDisambiguationTitle(page.title)) {
      return page;
    }
  }
  return null;
}

// All disambiguation suffixes across all categories — to detect wrong category results
const ALL_DISAMBIGUATION_HINTS = new Set(
  Object.values(DISAMBIGUATION_HINTS).flat().map(h => h.toLowerCase())
);

function isWrongCategoryDisambiguation(title, cat) {
  // If title contains "(hint)" where hint belongs to a DIFFERENT category — reject
  const match = title.match(/\(([^)]+)\)$/);
  if (!match) return false;
  const suffix = match[1].toLowerCase();
  // Check if this suffix appears in hints for OTHER categories
  for (const [c, hints] of Object.entries(DISAMBIGUATION_HINTS)) {
    if (c === cat) continue;
    if (hints.map(h => h.toLowerCase()).includes(suffix)) return true;
  }
  return false;
}
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
    p31AnyOf: new Set(["Q2095","Q746549","Q13233","Q19861951","Q11004","Q1364","Q12140","Q8502","Q16521",
      "Q25403900", // vegetable (P366 has use)
      "Q1179171",  // food ingredient
    ]),
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
    p31AnyOf: new Set(["Q223557","Q8205328","Q2424752","Q39546","Q1183543","Q11460","Q14745","Q15026"]),
    catKeywords: ["objects","tools","devices","equipment","inventions","household","furniture","rooms","interior","architecture","building","construction","containers","storage","packaging","geology","rocks","minerals","musical notation","writing","stationery","cabinets","shelving"],
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
    catKeywords: ["vegetables","vegetable","root vegetables","leaf vegetables","edible plants"],
    rejectKeywords: ["cereals","grains","grain","cereal","staple food","rice","wheat","corn","legumes","pulses"],
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
  Object:     { catKeywords: ["כלים","מכשירים","ציוד","רהיטים","רהיט","חפצים","מיכלים","סלעים","מינרלים","אדריכלות","כלי נגינה","אחסון","ריהוט"] },
  Sport:      { catKeywords: ["ספורט","ענפי ספורט","משחקים","אתלטיקה","אולימפי","כדורגל","כדורסל"] },
  Movie:      { catKeywords: ["סרטים","סרט","קולנוע","אנימציה","קומדיה","דרמה","בימוי"] },
  Vegetable:  { catKeywords: ["ירקות","ירק","צמחים אכילים","ירקות שורש","ירקות עלים"], rejectKeywords: ["דגנים","דגן","קטניות","אורז","חיטה","תירס","קמח"] },
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
const FOOD_WHITELIST_HE = new Set([
  // חטיפים וממתקים
  "במבה","בורקס","בלינצס","ביסלי","בקלאווה","פלאפל","חומוס","שווארמה","קבב","סביח","לחמג'ון",
  // ירקות נפוצים
  "כרוב","גזר","עגבניה","מלפפון","בצל","שום","תפוח אדמה","חציל","פלפל","קישוא","סלרי",
  "ברוקולי","כרובית","תרד","חסה","אספרגוס","ארטישוק","לפת","צנון","סלק","שעועית",
  "אפונה","תירס","דלעת","בטטה","פטריה","כרישה","שמיר","פטרוזיליה","כוסברה","נענע",
  // פירות נפוצים
  "תפוח","תפוז","בננה","ענב","אבטיח","מלון","תות","אשכולית","לימון","רימון",
  "אגס","שזיף","משמש","אפרסק","מנגו","אננס","קיווי","תמר","תאנה","זית",
  // דגנים וקטניות
  "אורז","חיטה","שעורה","עדשים","חומוס","סויה","שיבולת שועל",
  // מוצרי חלב ובשר
  "גבינה","יוגורט","חלב","ביצה","עוף","בשר","דג","טונה","סלמון",
]);
const NAME_WHITELIST_EN   = new Set(["fani","farida","fahad","faisal","fatima","farah","felix","fiona","flora","frank","fred","freddy","frances","francesca","franco","franz","fadi","fares","fanny","fiona"]);
const PROFESSION_WHITELIST_EN = new Set([
  "farman","fireman","fisherman","foreman","filmmaker","florist","forensicist","fundraiser","facilitator",
  "jail officer","jailer","janitor","journalist","judge","jurist","jeweler"
]);

const VEGETABLE_WHITELIST_HE = new Set([
  "כרוב","גזר","עגבניה","מלפפון","בצל","שום","תפוח אדמה","חציל","פלפל","קישוא","סלרי",
  "ברוקולי","כרובית","תרד","חסה","אספרגוס","ארטישוק","לפת","צנון","סלק","שעועית",
  "אפונה","תירס","דלעת","בטטה","פטריה","כרישה","שמיר","פטרוזיליה","כוסברה","נענע",
  "חומוס","עדשים","שעועית ירוקה","כרוב ניצנים","סלק אדום"
]);

const NAME_WHITELIST_HE = new Set([
  "סיון","סיגל","סיגלית","סמדר","שרית","שירה","שקד","שחר","שי","שירן",
  "נועה","נעמה","נוי","נטע","נגה","נמרוד",
  "אביב","אביגיל","אביתר","אדם","אהרון","אורי","אורית","אילן","אילנה",
  "ליאור","לירון","לירי","לי","לבנה",
  "מיכל","מיכאל","מור","מיה","מעיין",
  "יעל","יונה","יובל","יפה","יניב",
  "תמר","תהילה","תום",
  "רון","רוני","רחל","רבקה","ראם",
  "קרן","קורל","קמיל",
  "דנה","דן","דביר","דורון","דפנה",
  "גלי","גל","גיא","גבריאל",
  "עמית","עדי","עינב","עומר",
  "פז","פנינה","פיליפ",
  "זיו","זוהר","זהבה",
  "חן","חנה","חגית","חיים",
  "טל","טלי","טובה","טניה"
]);

const CAR_WHITELIST_HE = new Set([
  "פיאט","פורד","פרארי","פולקסווגן","פורשה","פיג'ו",
  "הונדה","יונדאי","המר",
  "טויוטה","טסלה",
  "בי אם וי","בנטלי","בואיק","בוגאטי",
  "שברולט","סיטרואן","קאדילק",
  "דאצ'יה","דודג'","דיהטסו",
  "קיה","קוניגסג",
  "למבורגיני","לקסוס","לוטוס","לינקולן",
  "מזדה","מרצדס","מיצובישי","מזראטי","מיני",
  "ניסאן","אופל",
  "רנו","רולס רויס",
  "סיאט","סובארו","סוזוקי","סאאב","סקודה",
  "וולוו","אאודי","אלפא רומיאו","אסטון מרטין",
  "ג'יפ","ג'גואר","ג'נסיס",
  "ביואיק","קרייזלר","שברולט"
]);

// Car brands that Wikipedia may not recognize directly as cars
const CAR_BRAND_WHITELIST = new Set([
  "jaguar","jeep","jensen","jac",
  "fiat","ford","ferrari","fisker",
  "honda","hyundai","hummer",
  "toyota","tesla","triumph",
  "bmw","bentley","bugatti","buick",
  "chevrolet","chrysler","citroen","cadillac",
  "dodge","dacia","daewoo",
  "kia","koenigsegg",
  "lamborghini","lexus","lincoln","lotus",
  "mazda","mercedes","mitsubishi","maserati","mini",
  "nissan",
  "opel",
  "peugeot","porsche",
  "renault","rolls royce",
  "seat","subaru","suzuki","saab","skoda",
  "volkswagen","volvo",
  "alfa romeo","aston martin","audi"
]);

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
    // Reject if matches rejectKeywords
    if (rules.rejectKeywords && keywordMatch(categories, rules.rejectKeywords)) return false;
    // Must match either P31 or category keywords — not just any page
    const p31Match = ids.some(id => rules.p31AnyOf?.has(id));
    const catMatch = keywordMatch(categories, rules.catKeywords);
    return p31Match || catMatch;
  }

  // City: reject countries, regions, continents
  if (cat === "City") {
    const COUNTRY_IDS = new Set(["Q6256","Q3624078","Q7275","Q3024240","Q15634554","Q82794","Q855697"]);
    if (ids.some(id => COUNTRY_IDS.has(id))) return false;
    if (keywordMatch(categories, ["countries","sovereign states","regions","territories","continents","מדינות","ארצות","יבשות","אזורים"])) return false;
  }

  // Country: reject cities
  if (cat === "Country") {
    if (ids.includes(WRONG_TYPE_P31.city)) return false;
    if (keywordMatch(categories, ["cities","towns","municipalities","ערים","עיירות"])) return false;
  }

  if (cat === "Food") {
    const isTaxon = ids.includes("Q16521");
    const hasFoodCats = keywordMatch(categories, rules.catKeywords);
    const p31DirectFood = ids.some(id => id !== "Q16521" && rules.p31AnyOf.has(id));
    // P366 "has use: food" (Q2095) or "has use: vegetable" — from combined P31+P366
    const hasUseFood = ids.includes("Q2095") || ids.includes("Q11004") || ids.includes("Q1364");
    if (p31DirectFood) return true;
    if (hasUseFood) return true; // כרוב: taxon with has use = food ✓
    if (FOOD_WHITELIST_EN.has(answerLower)) return hasFoodCats;
    if (isTaxon) return hasFoodCats;
    return hasFoodCats;
  }

  if (cat === "Object") {
    // Object = any inanimate thing — reject people, places, animals, plants, abstract concepts
    const REJECT_FOR_OBJECT = new Set([
      "Q5",      // human
      "Q515","Q3957","Q1549591", // city
      "Q6256","Q3624078","Q7275", // country
      "Q16521",  // taxon (animal/plant) — unless has use = food tool etc
      "Q7432",   // species
    ]);
    if (ids.some(id => REJECT_FOR_OBJECT.has(id))) {
      // Allow taxon only if it's a tool/material (e.g. bamboo used as object)
      if (ids.includes("Q16521") && !keywordMatch(categories, ["tools","material","wood","stone","mineral"])) return false;
      if (!ids.includes("Q16521")) return false;
    }
    if (keywordMatch(categories, ["people","politicians","actors","singers","athletes","cities","countries","animals","birds","fish","mammals"])) return false;
    // Accept if Wikipedia page exists and is not a person/place/animal
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

  // City: reject countries/regions using Wikidata
  if (cat === "City") {
    const COUNTRY_IDS = new Set(["Q6256","Q3624078","Q7275","Q3024240","Q15634554","Q82794","Q855697"]);
    if (instanceOf.some(id => COUNTRY_IDS.has(id))) return false;
    if (keywordMatch(page.categories, ["מדינות","ארצות","יבשות","אזורים","regions","countries"])) return false;
  }
  // Country: reject cities
  if (cat === "Country") {
    if (instanceOf.includes(WRONG_TYPE_P31.city)) return false;
    if (keywordMatch(page.categories, ["ערים","עיירות","cities","towns"])) return false;
  }
  // Object: accept any inanimate thing — reject people/places/animals
  if (cat === "Object") {
    const REJECT_FOR_OBJECT = new Set(["Q5","Q515","Q3957","Q6256","Q3624078","Q7275","Q7432"]);
    if (instanceOf.some(id => REJECT_FOR_OBJECT.has(id))) return false;
    if (instanceOf.includes("Q16521") && !keywordMatch(page.categories, ["כלים","חומר","עץ","אבן","מינרל"])) return false;
    if (keywordMatch(page.categories, ["אנשים","פוליטיקאים","שחקנים","זמרים","ספורטאים","ערים","מדינות","בעלי חיים","עופות","דגים"])) return false;
    return page.exists;
  }

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
    // Food: accept if P366 has use = food/vegetable/fruit
    if (cat === "Food") {
      if (instanceOf.includes("Q2095") || instanceOf.includes("Q11004") || instanceOf.includes("Q1364")) return true;
    }
    for (const id of instanceOf) {
      if (enRules.p31AnyOf.has(id)) return true;
    }
  }

  // Fall back to Hebrew category keywords
  if (rules.rejectKeywords && keywordMatch(page.categories, rules.rejectKeywords)) return false;
  return keywordMatch(page.categories, rules.catKeywords);
}

// ─────────────────────────────────────────────────────────────────────────────
// DICTIONARY APIs
// ─────────────────────────────────────────────────────────────────────────────

// English: Datamuse API — checks if word exists as a real English word/phrase
async function checkEnglishDictionary(word) {
  const key = `dict_en:${word.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  try {
    const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&max=1&md=f`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) { cacheSet(key, false); return false; }
    const data = await r.json();
    // Datamuse returns results if the word exists — exact match check
    const exists = data.some(w => w.word.toLowerCase() === word.toLowerCase());
    cacheSet(key, exists);
    return exists;
  } catch {
    return false;
  }
}

// Hebrew: Wiktionary API — checks if word exists in Hebrew Wiktionary
async function checkHebrewDictionary(word) {
  const key = `dict_he:${word}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  try {
    const url = `https://he.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&origin=*`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) { cacheSet(key, false); return false; }
    const data = await r.json();
    const pages = data?.query?.pages;
    const exists = pages && !Object.values(pages).some(p => p.missing !== undefined);
    cacheSet(key, !!exists);
    return !!exists;
  } catch {
    return false;
  }
}

// Categories where dictionary check makes sense (common nouns, not proper nouns)
const DICT_CHECK_CATS = new Set(["Animal","Food","Vegetable","Fruit","Color","Flower","Instrument","Clothing","Object"]);

// All categories require EXACT word count match
const EXACT_MATCH_CATS = new Set([
  "Movie","Celebrity","Brand","Sport","River","Language","Country","City","Car",
  "Animal","Food","Vegetable","Fruit","Color","Flower","Instrument","Clothing","Object","Profession","Name"
]);

function titleMatchesAnswer(page, answer, cat) {
  const checkTitle = (page.originalTitle || page.title).toLowerCase().trim();
  // Remove disambiguation suffix like "(שם פרטי)" from title for comparison
  const cleanTitle = checkTitle.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const answerLower = answer.toLowerCase().trim();
  const answerWords = answerLower.split(/\s+/);
  const titleWords = cleanTitle.split(/\s+/);

  // First word must match exactly
  if (answerWords[0] !== titleWords[0]) return false;

  // Answer must not have MORE words than title
  if (answerWords.length > titleWords.length) return false;

  // For exact match categories — answer must have SAME number of words as title
  if (cat && EXACT_MATCH_CATS.has(cat) && answerWords.length !== titleWords.length) return false;

  // Each answer word must match the corresponding title word (prefix ok for last word in non-exact cats)
  for (let i = 0; i < answerWords.length; i++) {
    if (i < answerWords.length - 1) {
      if (answerWords[i] !== titleWords[i]) return false;
    } else {
      if (cat && EXACT_MATCH_CATS.has(cat)) {
        // Exact match required for last word too
        if (answerWords[i] !== titleWords[i]) return false;
      } else {
        // Prefix ok for last word
        if (!titleWords[i]?.startsWith(answerWords[i])) return false;
      }
    }
  }

  return true;
}

async function validateOneEN(cat, answerRaw, letter) {
  const answer = normAnswer(answerRaw);
  const answerLower = answer.toLowerCase();

  if (!answer)                            return { valid: false, reason: "Empty" };
  if (!startsWithLetter(answer, letter))  return { valid: false, reason: `Does not start with "${letter}"` };
  if (isObviouslyGibberish(answer))       return { valid: false, reason: "Looks like gibberish" };

  // Whitelists for known valid answers Wikipedia may miss
  if (cat === "Name" && NAME_WHITELIST_EN.has(answerLower)) {
    return { valid: true, reason: `Known given name (${answer})` };
  }

  // For Name category — try "(given name)" disambiguation FIRST
  if (cat === "Name") {
    const nameSpecific = await resolveWikipediaPage(`${answer} (given name)`, "en");
    if (nameSpecific.exists && !isDisambiguationTitle(nameSpecific.title)) {
      return { valid: true, reason: `Wikipedia-verified (${nameSpecific.title})` };
    }
    // Also try Wikidata P31 check directly
    const nameDirect = await resolveWikipediaPage(answer, "en");
    if (nameDirect.exists && nameDirect.wikibaseItem) {
      let instanceOf = [];
      try { instanceOf = await getWikidataInstanceOf(nameDirect.wikibaseItem); } catch {}
      const NAME_P31 = new Set(["Q202444","Q11879590","Q3409032","Q4116295"]);
      if (instanceOf.some(id => NAME_P31.has(id))) {
        return { valid: true, reason: `Wikipedia-verified (${nameDirect.title})` };
      }
    }
  }
  if (cat === "Profession" && PROFESSION_WHITELIST_EN.has(answerLower)) {
    return { valid: true, reason: `Known profession (${answer})` };
  }
  if (cat === "Car" && CAR_BRAND_WHITELIST.has(answerLower)) {
    return { valid: true, reason: `Known car brand (${answer})` };
  }

  // Some countries Wikipedia title may differ slightly
  const COUNTRY_WHITELIST = new Set(["jordan","japan","jamaica","jersey"]);
  if (cat === "Country" && COUNTRY_WHITELIST.has(answerLower)) {
    return { valid: true, reason: `Known country (${answer})` };
  }

  // Direct lookup — verify title starts with letter AND matches first word of answer
  const direct = await resolveWikipediaPage(answer, "en");
  if (direct.exists && !isDisambiguationTitle(direct.title)) {
    // For Celebrity: if answer is one word but Wikipedia title has multiple words,
    // only accept if the Wikipedia title itself is also one word (mononym like Beyoncé, Adele)
    if (cat === "Celebrity" && answer.trim().split(/\s+/).length === 1) {
      const titleWords = direct.title.trim().split(/\s+/);
      if (titleWords.length > 1) {
        return { valid: false, reason: `Please enter the full name (e.g. "${direct.title}")` };
      }
    }
    if (!titleMatchesAnswer(direct, answer, cat)) {
      return { valid: false, reason: `"${answer}" is not a valid ${cat} starting with "${letter}"` };
    }
    let instanceOf = [];
    if (direct.wikibaseItem) try { instanceOf = await getWikidataInstanceOf(direct.wikibaseItem); } catch {}
    if (categoryMatchEN(cat, instanceOf, direct.categories, answerLower)) {
      return { valid: true, reason: `Wikipedia-verified (${direct.title})` };
    }
  }

  // If disambiguation — try specific meaning
  if (direct.exists && isDisambiguationTitle(direct.title)) {
    const specific = await resolveFromDisambiguation(answer, cat, "en");
    if (specific && titleMatchesAnswer(specific, answer, cat)) {
      let instanceOf = [];
      if (specific.wikibaseItem) try { instanceOf = await getWikidataInstanceOf(specific.wikibaseItem); } catch {}
      if (categoryMatchEN(cat, instanceOf, specific.categories, answerLower)) {
        return { valid: true, reason: `Wikipedia-verified (${specific.title})` };
      }
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
      if (!titleMatchesAnswer(p, answer, cat)) continue;
      if (isWrongCategoryDisambiguation(p.title, cat)) continue;
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

  // Whitelist — known Hebrew foods that Wikipedia may misclassify
  if (cat === "Food" && FOOD_WHITELIST_HE.has(answer)) {
    return { valid: true, reason: `מאכל מוכר (${answer})` };
  }
  if (cat === "Vegetable" && VEGETABLE_WHITELIST_HE.has(answer)) {
    return { valid: true, reason: `ירק מוכר (${answer})` };
  }
  if (cat === "Car" && CAR_WHITELIST_HE.has(answer)) {
    return { valid: true, reason: `מותג רכב מוכר (${answer})` };
  }
  if (cat === "Name" && NAME_WHITELIST_HE.has(answer)) {
    return { valid: true, reason: `שם פרטי מוכר (${answer})` };
  }

  // For Name category — try "(שם פרטי)" disambiguation FIRST
  if (cat === "Name") {
    const nameSpecific = await resolveWikipediaPage(`${answer} (שם פרטי)`, "he");
    if (nameSpecific.exists && !isDisambiguationTitle(nameSpecific.title)) {
      return { valid: true, reason: `אומת בויקיפדיה (${nameSpecific.title})` };
    }
    // Also try English Wikidata — names are language-agnostic
    const nameEn = await resolveWikipediaPage(answer, "en");
    if (nameEn.exists && !isDisambiguationTitle(nameEn.title)) {
      let instanceOf = [];
      if (nameEn.wikibaseItem) try { instanceOf = await getWikidataInstanceOf(nameEn.wikibaseItem); } catch {}
      const NAME_P31 = new Set(["Q202444","Q11879590","Q3409032","Q4116295"]);
      if (instanceOf.some(id => NAME_P31.has(id))) {
        return { valid: true, reason: `שם פרטי אומת (${answer})` };
      }
    }
  }

  // 1) Direct Hebrew Wikipedia lookup
  const direct = await resolveWikipediaPage(answer, "he");
  if (direct.exists && !isDisambiguationTitle(direct.title)) {
    // For Celebrity: if answer is one word but Wikipedia title has multiple words,
    // only accept if the Wikipedia title itself is also one word (mononym)
    if (cat === "Celebrity" && answer.trim().split(/\s+/).length === 1) {
      const titleWords = direct.title.trim().split(/\s+/);
      if (titleWords.length > 1) {
        return { valid: false, reason: `נא להזין שם מלא (למשל "${direct.title}")` };
      }
    }
    if (!titleMatchesAnswer(direct, answer, cat)) {
      return { valid: false, reason: `"${answer}" לא תואם לקטגוריה "${CAT_NAMES_HE[cat] || cat}"` };
    }
    if (await categoryMatchHE(cat, direct)) {
      return { valid: true, reason: `אומת בויקיפדיה (${direct.title})` };
    }
  }

  // 1b) If disambiguation — try specific meaning
  if (direct.exists && isDisambiguationTitle(direct.title)) {
    const specific = await resolveFromDisambiguation(answer, cat, "he");
    if (specific && titleMatchesAnswer(specific, answer, cat)) {
      if (await categoryMatchHE(cat, specific)) {
        return { valid: true, reason: `אומת בויקיפדיה (${specific.title})` };
      }
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
      if (!titleMatchesAnswer(p, answer, cat)) continue;
      if (isWrongCategoryDisambiguation(p.title, cat)) continue;
      if (await categoryMatchHE(cat, p)) {
        return { valid: true, reason: `אומת בויקיפדיה (${p.title})` };
      }
    }
  }

  if (!direct.exists) return { valid: false, reason: "לא נמצא דף ויקיפדיה תואם" };
  return { valid: false, reason: `"${direct.title}" לא תואם לקטגוריה "${CAT_NAMES_HE[cat] || cat}"` };
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
      fallback[c] = { valid: false, reason: "timeout", timeout: true };
    });
    return res.status(200).json(fallback);
  }
      }
