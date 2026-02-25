const CATS = ["Country","City","Animal","Food","Celebrity","Brand","Object"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { answers, letter } = req.body;
  if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

  const lines = CATS.map(c => `${c}: "${(answers[c]||"").trim()||"(empty)"}"`).join("\n");

  const prompt = `You are an extremely strict judge for the word game "Stop/Alphabet Game".

The letter this round is: "${letter}"

For each category you must validate TWO things:
1. The answer starts with the letter "${letter}" (case-insensitive). If it does not, it is INVALID.
2. The answer is a REAL, WELL-KNOWN, ACTUALLY EXISTING thing in that category.

CRITICAL RULES — apply these without exception:
- The answer must be a real thing that actually exists in the real world. Made-up words, nonsense, gibberish, random letters (like "bbb", "aaa", "xyz"), and non-existent entries are ALWAYS invalid worth 0 points.
- Country: must be a real sovereign nation recognized internationally (e.g. Brazil, Belgium). City names are NOT countries. Gibberish is NOT a country.
- City: must be a real city or major town. Country names are NOT cities.
- Animal: must be a real species of animal. Made-up animals are invalid.
- Food: must be a real food or drink that people eat. Person names are NOT food.
- Celebrity: must be a real famous living or historical person known internationally.
- Brand: must be a real company or product brand that exists.
- Object: must be a real physical tangible object that exists.
- If the answer is empty, nonsense, random characters, or clearly not a real thing — mark it invalid.
- Do NOT give benefit of the doubt. If you are not confident it is real and correct, mark it invalid.

Respond ONLY with minified JSON, no markdown, no explanation:
{"Country":{"valid":true,"reason":"..."},"City":{"valid":false,"reason":"..."},"Animal":{"valid":true,"reason":"..."},"Food":{"valid":false,"reason":"..."},"Celebrity":{"valid":true,"reason":"..."},"Brand":{"valid":false,"reason":"..."},"Object":{"valid":true,"reason":"..."}}

Answers to judge:
${lines}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();
    const txt = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(txt));
  } catch (err) {
    console.error("Anthropic error:", err);
    // Strict fallback: only pass if answer is at least 3 chars and starts with letter
    const fallback = {};
    CATS.forEach(c => {
      const v = (answers[c] || "").trim();
      const ok = v.length >= 3 && v.toLowerCase().startsWith(letter.toLowerCase());
      fallback[c] = { valid: ok, reason: ok ? "Starts with letter" : "Invalid or empty" };
    });
    return res.status(200).json(fallback);
  }
}
