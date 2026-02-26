// pages/api/matchmake.js
// Random matchmaking using ONLY the tables described in README:
// - rooms (status: waiting|playing|finished)
// Optional: queue (we don't rely on it for correctness)
//
// Design goals:
// - No extra tables (no player_rooms)
// - Safe-ish concurrency without SQL transactions by using optimistic CAS updates
//   on `rooms.player_ids` equality.
// - Auto-clean stale waiting rooms so ghost tabs don't block matching.

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId, playerName } = req.body || {};
    if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });

    const sb = getSupabaseAdmin();

    // 0) Cleanup stale waiting rooms (ghost tabs).
    // Best-effort: delete waiting rooms older than 20 minutes.
    // (If your schema is shared with private rooms, those won't have status='waiting' for long.)
    try {
      await sb.from("rooms").delete().eq("status", "waiting").lt("created_at", nowMinusMinutes(20));
    } catch {
      // ignore cleanup errors
    }

    // 1) If I already have a recent room (refresh/reopen), return it.
    const { data: mine } = await sb
      .from("rooms")
      .select("*")
      .contains("player_ids", [playerId])
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine && mine[0]) {
      const room = mine[0];
      const opp = (room.players || []).find((p) => p !== playerName) || "Opponent";
      const matched = (room.player_ids || []).length >= 2 && room.status !== "waiting";

      // Best-effort: if we're already matched, remove both players from queue.
      if (matched) {
        try {
          const ids = Array.isArray(room.player_ids) ? room.player_ids : [];
          if (ids.length) await sb.from("queue").delete().in("player_id", ids);
        } catch {
          // ignore
        }
      }
      return res.status(200).json({ matched, room, opponentName: opp });
    }

    // 2) Try to join an existing waiting room that has exactly one player.
    const { data: waitingRooms } = await sb
      .from("rooms")
      .select("id, letter, status, players, player_ids, created_at")
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(25);

    if (Array.isArray(waitingRooms)) {
      for (const cand of waitingRooms) {
        const pids = Array.isArray(cand.player_ids) ? cand.player_ids : [];
        const pnames = Array.isArray(cand.players) ? cand.players : [];

        if (pids.length !== 1) continue;
        if (pids[0] === playerId) continue;

        // Skip very old waiting rooms (likely abandoned)
        if (cand.created_at && new Date(cand.created_at).getTime() < Date.now() - 15 * 60 * 1000) {
          continue;
        }

        const newPlayers = [pnames[0] || "Player", playerName];
        const newPlayerIds = [pids[0], playerId];

        // CAS update: succeed only if status still waiting AND player_ids is still exactly the old array.
        const { data: joined, error: joinErr } = await sb
          .from("rooms")
          .update({ status: "playing", players: newPlayers, player_ids: newPlayerIds })
          .eq("id", cand.id)
          .eq("status", "waiting")
          .eq("player_ids", pids)
          .select("*")
          .maybeSingle();

        if (!joinErr && joined) {
          // Best-effort: remove both players from queue.
          try {
            const ids = Array.isArray(joined.player_ids) ? joined.player_ids : [];
            if (ids.length) await sb.from("queue").delete().in("player_id", ids);
          } catch {
            // ignore
          }
          const opp = (joined.players || []).find((p) => p !== playerName) || "Opponent";
          return res.status(200).json({ matched: true, room: joined, opponentName: opp });
        }
      }
    }

    // 3) Nobody to match yet — create a waiting room.
    const roomId = makeId();
    const createdAt = new Date().toISOString();
    const insert = {
      id: roomId,
      letter: randomLetter(),
      status: "waiting",
      players: [playerName],
      player_ids: [playerId],
      answers: {},
      validation: {},
      created_at: createdAt,
    };

    const { data: created, error: cErr } = await sb.from("rooms").insert(insert).select("*").maybeSingle();
    if (cErr || !created) {
      return res.status(500).json({ error: "Failed to create room: " + (cErr?.message || "unknown") });
    }

    // Optional: best-effort add to queue table if it exists (for debugging/metrics).
    try {
      await sb
        .from("queue")
        .upsert({ player_id: playerId, player_name: playerName, joined_at: new Date().toISOString() });
    } catch {
      // ignore
    }

    return res.status(200).json({ matched: false, room: created });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
