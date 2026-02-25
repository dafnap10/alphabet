// pages/api/validate.js
// Server-side proxy — Anthropic API key stays secret on the server

const CATS = ["Country","City","Animal","Food","Celebrity","Brand","Object"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { answers, letter } = req.body;
  if (!answers || !letter) return res.status(400).json({ error: "Missing answers or letter" });

  const lines = CATS.map(c => `${c}: "${(answers[c]||"").trim()||"(empty)"}"`).join("\n");

  const prompt = `You are a strict judge for the word game "Stop/Alphabet Game".
Letter this round: "${letter}"

For each category validate:
1. Answer starts with "${letter}" (case-insensitive)
2. Answer genuinely belongs to the category (be strict — "Belgium" is a Country NOT a City, a person's name is NOT food, etc.)

Reply ONLY with minified JSON, no markdown:
{"Country":{"valid":true,"reason":"..."},"City":{"valid":false,"reason":"..."},"Animal":{"valid":true,"reason":"..."},"Food":{"valid":false,"reason":"..."},"Celebrity":{"valid":true,"reason":"..."},"Brand":{"valid":false,"reason":"..."},"Object":{"valid":true,"reason":"..."}}

Answers:
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
    const result = JSON.parse(txt);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Anthropic error:", err);
    // Fallback: basic letter check
    const fallback = {};
    CATS.forEach(c => {
      const v = (answers[c] || "").trim();
      const ok = v.length >= 2 && v.toLowerCase().startsWith(letter.toLowerCase());
      fallback[c] = { valid: ok, reason: ok ? "Valid" : "Invalid or empty" };
    });
    return res.status(200).json(fallback);
  }
}
