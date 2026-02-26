// pages/api/matchmake.js
// Random matchmaking (JSONB-safe) using ONLY:
// - rooms (jsonb player_ids / players)
// - queue (player_id, player_name, joined_at)
//
// Why: rooms.player_ids is JSONB, so "CAS" equality checks like .eq('player_ids', [...])
// are unreliable across PostgREST encodings. Instead, we use queue as the concurrency primitive:
// - Player enters queue (upsert)
// - Polling endpoint (/api/match-status) pairs two queued players by deleting BOTH rows with
//   count=2 (only one server will succeed), then creates the room.

import { getSupabaseAdmin } from "../../lib/supabase";

function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId, playerName } = req.body || {};
    if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });

    const sb = getSupabaseAdmin();

    // If already in a room (refresh/reopen), no need to queue.
    const { data: mine } = await sb
      .from("rooms")
      .select("id,status,players,player_ids,letter,created_at")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine && mine[0]) {
      const room = mine[0];
      const matched = Array.isArray(room.player_ids) && room.player_ids.length >= 2 && room.status !== "waiting";
      return res.status(200).json({ matched, room });
    }

    // Enqueue this player (idempotent).
    const joined_at = new Date().toISOString();
    const { error: qErr } = await sb
      .from("queue")
      .upsert({ player_id: playerId, player_name: playerName, joined_at });

    if (qErr) return res.status(500).json({ error: "Failed to join queue: " + qErr.message });

    // Best-effort cleanup of very old queue rows.
    try {
      await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30));
    } catch {
      // ignore
    }

    return res.status(200).json({ matched: false, queued: true });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
