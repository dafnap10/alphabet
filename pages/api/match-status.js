// pages/api/match-status.js
// Poll endpoint for random matchmaking.
// Finds the player's current room (by player_ids contains playerId).
// - If the room has 2 players and status != waiting => matched
// - If not in any room, tries a lightweight join attempt (same logic as matchmake)

import { getSupabaseAdmin } from "../../lib/supabase";

function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Best-effort cleanup of stale waiting rooms.
    try {
      await sb.from("rooms").delete().eq("status", "waiting").lt("created_at", nowMinusMinutes(20));
    } catch {}

    // 1) Check if the player is already in a room.
    const { data: mine } = await sb
      .from("rooms")
      .select("*")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine && mine[0]) {
      const room = mine[0];
      const matched = (room.player_ids || []).length >= 2 && room.status !== "waiting";
      return res.status(200).json({ matched, room });
    }

    // 2) If we don't have a room (rare), attempt a join of any waiting room.
    // This makes the system more robust if the first request failed.
    const { data: waitingRooms } = await sb
      .from("rooms")
      .select("id, status, players, player_ids, created_at")
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(25);

    if (Array.isArray(waitingRooms)) {
      for (const cand of waitingRooms) {
        const pids = Array.isArray(cand.player_ids) ? cand.player_ids : [];
        const pnames = Array.isArray(cand.players) ? cand.players : [];

        if (pids.length !== 1) continue;
        if (pids[0] === playerId) continue;
        if (cand.created_at && new Date(cand.created_at).getTime() < Date.now() - 15 * 60 * 1000) continue;

        // We don't know this caller's name here; joining without names would be ugly.
        // So we only report matched=false and let the client call /api/matchmake again.
        break;
      }
    }

    return res.status(200).json({ matched: false });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
