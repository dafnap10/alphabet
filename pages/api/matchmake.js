import { createClient } from "@supabase/supabase-js";

function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }
function makeId() { return Math.random().toString(36).substring(2, 10); }

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { playerId, playerName } = req.body || {};
    if (!playerId || !playerName) {
      return res.status(400).json({ error: "Missing playerId or playerName" });
    }

    // Check env vars
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        error: "Supabase env vars not configured",
        SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "MISSING",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING"
      });
    }

    const sb = getDB();
    const now = new Date();
    const stale = new Date(now.getTime() - 90000).toISOString();

    await sb.from("queue").delete().lt("joined_at", stale);

    const { data: waiting, error: qErr } = await sb
      .from("queue").select("*").neq("player_id", playerId)
      .order("joined_at", { ascending: true }).limit(1);

    if (qErr) return res.status(500).json({ error: "Queue error: " + qErr.message });

    const opponent = waiting?.[0];

    if (opponent) {
      await sb.from("queue").delete().eq("player_id", opponent.player_id);

      const roomId = makeId();
      const room = {
        id: roomId,
        letter: randomLetter(),
        status: "playing",
        players: [opponent.player_name, playerName],
        player_ids: [opponent.player_id, playerId],
        answers: {},
        validation: {}
      };

      const { error: insertErr } = await sb.from("rooms").insert(room);
      if (insertErr) return res.status(500).json({ error: "Insert error: " + insertErr.message });

      return res.status(200).json({ matched: true, room, opponentName: opponent.player_name });
    } else {
      const { error: upsertErr } = await sb.from("queue").upsert({
        player_id: playerId,
        player_name: playerName,
        joined_at: now.toISOString()
      });

      if (upsertErr) return res.status(500).json({ error: "Upsert error: " + upsertErr.message });

      return res.status(200).json({ matched: false });
    }
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
