import { getSupabaseAdmin } from "../../lib/supabase";

function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId, playerName, lang } = req.body || {};
    if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });

    const sb = getSupabaseAdmin();

    // Only return an existing room if it's actively "playing" with 2 players
    const { data: mine } = await sb
      .from("rooms")
      .select("id,status,players,player_ids,letter,created_at")
      .contains("player_ids", [playerId])
      .eq("status", "playing")
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine?.[0]) {
      const room = mine[0];
      if (Array.isArray(room.player_ids) && room.player_ids.length >= 2) {
        return res.status(200).json({ matched: true, room });
      }
    }

    // Try upsert with lang column first, fall back without it if column doesn't exist
    let qErr = null;
    const withLang = await sb.from("queue").upsert({
      player_id: playerId,
      player_name: playerName,
      lang: lang || "en",
      joined_at: new Date().toISOString(),
    });
    qErr = withLang.error;

    if (qErr) {
      // lang column probably doesn't exist yet — retry without it
      const withoutLang = await sb.from("queue").upsert({
        player_id: playerId,
        player_name: playerName,
        joined_at: new Date().toISOString(),
      });
      if (withoutLang.error) {
        return res.status(500).json({ error: "Failed to join queue: " + withoutLang.error.message });
      }
    }

    // Cleanup stale rows
    try { await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30)); } catch {}

    return res.status(200).json({ matched: false, queued: true });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
