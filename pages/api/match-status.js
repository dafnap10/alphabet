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
import crypto from "crypto";

function randomLetter() {
  return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)];
}

function stableRoomId(a, b) {
  // Deterministic id so retries are idempotent.
  const [x, y] = [String(a), String(b)].sort();
  return crypto.createHash("sha1").update(`${x}:${y}`).digest("hex").slice(0, 12);
}

function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId, playerName } = req.query;
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

    // IMPORTANT RACE FIX:
    // Another poller may have deleted my queue row in order to form a match,
    // but the room insert may not be visible yet. If we return queued:false,
    // the client can get stuck forever. Instead, re-enqueue best-effort.
    if (!meQ) {
      const myName = (playerName && String(playerName).trim()) || "Player";
      try {
        await sb.from("queue").upsert({
          player_id: playerId,
          player_name: myName,
          joined_at: new Date().toISOString(),
        });
      } catch {}
      return res.status(200).json({ matched: false, queued: true });
    }

    const myName = meQ.player_name || (playerName && String(playerName).trim()) || "Player";

    // 3) Leader-based pairing to avoid race windows that strand the second player.
    // Only the OLDEST queued player creates the match with the 2nd oldest.
    const { data: q2 } = await sb
      .from("queue")
      .select("player_id,player_name,joined_at")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (!q2 || q2.length < 2) return res.status(200).json({ matched: false, queued: true });

    const leader = q2[0];
    const opp = q2[1];

    // If I'm not the leader, just keep polling until the leader creates the room.
    if (leader.player_id !== playerId) {
      return res.status(200).json({ matched: false, queued: true });
    }

    const oppId = opp.player_id;
    const oppName = opp.player_name || "Opponent";

    // 4) Create (or reuse) a deterministic room id so retries are safe.
    const roomId = stableRoomId(playerId, oppId);
    const insert = {
      id: roomId,
      letter: randomLetter(),
      status: "playing",
      players: [myName, oppName],
      player_ids: [playerId, oppId],
      answers: {},
      validation: {},
      created_at: new Date().toISOString(),
    };

    // Try insert; if it already exists, fetch it.
    let room = null;
    const { data: created, error: cErr } = await sb.from("rooms").insert(insert).select("*").maybeSingle();
    if (cErr) {
      const { data: existing } = await sb
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      room = existing || null;
    } else {
      room = created || null;
    }

    if (!room) return res.status(200).json({ matched: false, queued: true });

    // 5) Cleanup queue AFTER the room is visible.
    try {
      await sb.from("queue").delete().in("player_id", [playerId, oppId]);
    } catch {}

    return res.status(200).json({ matched: true, room });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
