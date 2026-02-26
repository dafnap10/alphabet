// pages/api/leave-room.js
// Clears any existing random-match waiting room for a player.
// Used when switching modes (private <-> random) and when going Home.
//
// We do NOT rely on any extra tables like `player_rooms`.
// We only use `rooms` (and optionally `queue` if it exists).

import { getSupabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Remove from queue (best-effort; queue may not exist in some setups)
    try {
      await sb.from("queue").delete().eq("player_id", playerId);
    } catch {
      // ignore
    }

    // If player has a waiting room where they are the only player, delete it.
    const { data: mine } = await sb
      .from("rooms")
      .select("id, status, player_ids")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(5);

    if (Array.isArray(mine)) {
      for (const r of mine) {
        const pids = Array.isArray(r.player_ids) ? r.player_ids : [];
        if (r.status === "waiting" && pids.length === 1 && pids[0] === playerId) {
          await sb.from("rooms").delete().eq("id", r.id);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("leave-room error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
