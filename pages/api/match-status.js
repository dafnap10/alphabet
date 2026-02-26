// pages/api/match-status.js
// Poll endpoint for random matchmaking.
// JSONB-safe implementation using queue as the concurrency primitive.
//
// Flow:
// 1) If player already in a room (rooms.player_ids contains playerId) => return matched/room
// 2) Else, ensure player is in queue
// 3) Try to find the oldest other queued player
// 4) Attempt to "claim" the match by deleting BOTH queue rows with count=2
//    (only one poller across both players will succeed)
// 5) If claimed, create room with both players and return matched

import { getSupabaseAdmin } from "../../lib/supabase";

function randomLetter() {
  return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)];
}

function makeId() {
  return Math.random().toString(36).substring(2, 10);
}

function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Best-effort cleanup of stale queue rows.
    try {
      await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30));
    } catch {}

    // 1) Already in a room?
    const { data: mine } = await sb
      .from("rooms")
      .select("*")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine && mine[0]) {
      const room = mine[0];
      const matched = Array.isArray(room.player_ids) && room.player_ids.length >= 2 && room.status !== "waiting";

      if (matched) {
        // Best-effort: remove both players from queue.
        try {
          const ids = Array.isArray(room.player_ids) ? room.player_ids : [];
          if (ids.length) await sb.from("queue").delete().in("player_id", ids);
        } catch {}
        return res.status(200).json({ matched: true, room });
      }

      return res.status(200).json({ matched: false, room });
    }

    // 2) Ensure I'm in queue (matchmake should have done it, but this makes polling robust)
    const { data: meQ } = await sb
      .from("queue")
      .select("player_id,player_name,joined_at")
      .eq("player_id", playerId)
      .maybeSingle();

    if (!meQ) {
      // Not queued, not in a room.
      return res.status(200).json({ matched: false, queued: false });
    }

    const myName = meQ.player_name || "Player";

    // 3) Find the oldest other queued player.
    const { data: oppList } = await sb
      .from("queue")
      .select("player_id,player_name,joined_at")
      .neq("player_id", playerId)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (!oppList || !oppList[0]) {
      return res.status(200).json({ matched: false, queued: true });
    }

    const opp = oppList[0];
    const oppId = opp.player_id;
    const oppName = opp.player_name || "Opponent";

    // 4) Claim the match by deleting both queue rows.
    // Only one server call across both players will succeed with count === 2.
    const { count: delCount, error: delErr } = await sb
      .from("queue")
      .delete({ count: "exact" })
      .in("player_id", [playerId, oppId]);

    if (delErr || delCount !== 2) {
      // Someone else matched us first; keep polling.
      return res.status(200).json({ matched: false, queued: true });
    }

    // 5) Create the room.
    const roomId = makeId();
    const insert = {
      id: roomId,
      letter: randomLetter(),
      status: "playing",
      players: [oppName, myName],
      player_ids: [oppId, playerId],
      answers: {},
      validation: {},
      created_at: new Date().toISOString(),
    };

    const { data: created, error: cErr } = await sb.from("rooms").insert(insert).select("*").maybeSingle();

    if (cErr || !created) {
      // Put both players back into queue (best-effort) so they can match again.
      try {
        await sb.from("queue").upsert([
          { player_id: playerId, player_name: myName, joined_at: new Date().toISOString() },
          { player_id: oppId, player_name: oppName, joined_at: new Date().toISOString() },
        ]);
      } catch {}
      return res.status(500).json({ error: "Failed to create room: " + (cErr?.message || "unknown") });
    }

    return res.status(200).json({ matched: true, room: created });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
