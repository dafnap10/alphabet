// pages/api/leave-room.js
// Called when a player goes Home, cancels matchmaking, or switches modes.
// - Removes from queue
// - For random rooms (id is a hash, not a lobby code): marks as "finished"
//   so it can never be returned as an active room in future matchmaking
// - Does NOT touch private lobby rooms (they use alphanumeric codes like "AB3X7Q")

import { getSupabaseAdmin } from "../../lib/supabase";

// Lobby codes are 6 uppercase alphanumeric chars (A-Z0-9)
// Random room IDs are 12-char hex hashes
function isLobbyRoom(id) {
  return /^[A-Z0-9]{4,8}$/.test(id || "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Remove from matchmaking queue
    try { await sb.from("queue").delete().eq("player_id", playerId); } catch {}

    // Find rooms this player is in
    const { data: mine } = await sb
      .from("rooms")
      .select("id, status, player_ids")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(10);

    if (Array.isArray(mine)) {
      for (const r of mine) {
        const pids = Array.isArray(r.player_ids) ? r.player_ids : [];

        if (r.status === "waiting" && pids.length === 1 && pids[0] === playerId) {
          // Solo waiting room — delete it entirely
          await sb.from("rooms").delete().eq("id", r.id);
        } else if (r.status === "playing" && !isLobbyRoom(r.id)) {
          // Random match room — mark finished so it won't trap future matchmaking
          // Private lobby rooms are left untouched (rematch support)
          await sb.from("rooms").update({ status: "finished" }).eq("id", r.id);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("leave-room error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
