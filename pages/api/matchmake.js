// pages/api/matchmake.js
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

    // Only return a room that is actively "playing" with 2 players.
    // Filtering by status=playing means finished/old rooms never trap a returning player.
    const { data: mine } = await sb
      .from("rooms")
      .select("id,status,players,player_ids,letter,created_at")
      .contains("player_ids", [playerId])
      .eq("status", "playing")
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine && mine[0]) {
      const room = mine[0];
      const matched = Array.isArray(room.player_ids) && room.player_ids.length >= 2;
      if (matched) return res.status(200).json({ matched: true, room });
    }

    // Enqueue this player (upsert = idempotent)
    const { error: qErr } = await sb
      .from("queue")
      .upsert({ player_id: playerId, player_name: playerName, lang: lang || "en", joined_at: new Date().toISOString() });

    if (qErr) return res.status(500).json({ error: "Failed to join queue: " + qErr.message });

    // Cleanup very stale rows
    try { await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30)); } catch {}

    return res.status(200).json({ matched: false, queued: true });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
