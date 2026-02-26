import { createClient } from "@supabase/supabase-js";

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  try {
    const sb = getDB();

    // GET — fetch room
    if (req.method === "GET") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const { data, error } = await sb.from("rooms").select("*").eq("id", id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Room not found" });
      return res.status(200).json(data);
    }

    // POST or PATCH — save answers + validation for a player
    if (req.method === "POST" || req.method === "PATCH") {
      const { id, playerId, playerName, answers, validation } = req.body || {};
      if (!id) return res.status(400).json({ error: "Missing id" });
      // IMPORTANT:
      // Use playerId as the storage key when available.
      // This prevents a critical bug where two players choose the same name,
      // causing one submission to overwrite the other and both clients to get stuck.
      const storageKey = String(playerId || playerName || "").trim();
      if (!storageKey) return res.status(400).json({ error: "Missing playerId or playerName" });

      // IMPORTANT:
      // Two players can submit at nearly the same time.
      // A naive read→merge→write can lose the other player's submission (last write wins).
      // We mitigate this by retrying and re-merging until the stored JSON contains
      // all keys we intended to write.
      const myKey = storageKey;
      const myAns = answers ?? null;
      const myVal = validation ?? null;

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: room, error: fetchErr } = await sb
          .from("rooms")
          .select("id, answers, validation")
          .eq("id", id)
          .maybeSingle();

        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        if (!room) return res.status(404).json({ error: "Room not found" });

        const mergedAnswers = { ...(room.answers || {}), [myKey]: myAns };
        const mergedValidation = { ...(room.validation || {}), [myKey]: myVal };

        const { error: upErr } = await sb
          .from("rooms")
          .update({ answers: mergedAnswers, validation: mergedValidation })
          .eq("id", id);

        if (upErr) return res.status(500).json({ error: upErr.message });

        // Re-fetch to confirm the merge stuck (and didn't drop keys due to a race)
        const { data: confirm, error: cErr } = await sb
          .from("rooms")
          .select("answers, validation")
          .eq("id", id)
          .maybeSingle();

        if (cErr) return res.status(500).json({ error: cErr.message });
        const okAnswers = Object.keys(mergedAnswers).every((k) => confirm?.answers?.[k] !== undefined);
        const okVals = Object.keys(mergedValidation).every((k) => confirm?.validation?.[k] !== undefined);

        if (okAnswers && okVals) return res.status(200).json({ ok: true });

        // small backoff before retry
        await sleep(60 + attempt * 40);
      }

      // If we couldn't confirm after retries, still return OK.
      // The client poll will usually resolve once the DB has both submissions.
      return res.status(200).json({ ok: true, warn: "merge_not_confirmed" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("room error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
