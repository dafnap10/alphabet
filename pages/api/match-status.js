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
    const { playerId, playerName: playerNameQ } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Try to get the player's name (needed to join a room deterministically).
    let playerName = (playerNameQ || "").toString().trim();
    if (!playerName) {
      try {
        const { data: qrow } = await sb
          .from("queue")
          .select("player_name")
          .eq("player_id", playerId)
          .maybeSingle();
        if (qrow?.player_name) playerName = qrow.player_name;
      } catch {
        // ignore
      }
    }
    if (!playerName) playerName = "Player";

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

      if (matched) {
        // Best-effort: remove both players from queue.
        try {
          const ids = Array.isArray(room.player_ids) ? room.player_ids : [];
          if (ids.length) await sb.from("queue").delete().in("player_id", ids);
        } catch {}
        return res.status(200).json({ matched: true, room });
      }

      // If I'm stuck alone in a waiting room, proactively try to join another waiting room.
      const myIds = Array.isArray(room.player_ids) ? room.player_ids : [];
      if (room.status === "waiting" && myIds.length === 1) {
        const myCreated = room.created_at ? new Date(room.created_at).getTime() : Date.now();

        const { data: waitingRooms } = await sb
          .from("rooms")
          .select("id, letter, status, players, player_ids, created_at")
          .eq("status", "waiting")
          .order("created_at", { ascending: true })
          .limit(25);

        if (Array.isArray(waitingRooms)) {
          for (const cand of waitingRooms) {
            if (!cand || cand.id === room.id) continue;
            const pids = Array.isArray(cand.player_ids) ? cand.player_ids : [];
            const pnames = Array.isArray(cand.players) ? cand.players : [];
            if (pids.length !== 1) continue;
            if (pids[0] === playerId) continue;
            if (cand.created_at && new Date(cand.created_at).getTime() < Date.now() - 15 * 60 * 1000) continue;

            // Prefer joining older rooms to reduce the chance both players keep creating separate rooms.
            const candCreated = cand.created_at ? new Date(cand.created_at).getTime() : 0;
            if (candCreated > myCreated + 2000) {
              // candidate is newer than mine by >2s; skip so the older room gets filled.
              continue;
            }

            const newPlayers = [pnames[0] || "Player", playerName];
            const newPlayerIds = [pids[0], playerId];

            const { data: joined, error: joinErr } = await sb
              .from("rooms")
              .update({ status: "playing", players: newPlayers, player_ids: newPlayerIds })
              .eq("id", cand.id)
              .eq("status", "waiting")
              .eq("player_ids", pids)
              .select("*")
              .maybeSingle();

            if (!joinErr && joined) {
              // Best-effort: delete my old waiting room to avoid leaving ghosts.
              try {
                await sb
                  .from("rooms")
                  .delete()
                  .eq("id", room.id)
                  .eq("status", "waiting")
                  .eq("player_ids", [playerId]);
              } catch {}

              // Best-effort: remove both players from queue.
              try {
                const ids = Array.isArray(joined.player_ids) ? joined.player_ids : [];
                if (ids.length) await sb.from("queue").delete().in("player_id", ids);
              } catch {}

              return res.status(200).json({ matched: true, room: joined });
            }
          }
        }
      }

      return res.status(200).json({ matched: false, room });
    }

    // 2) If we don't have a room (rare), attempt a join of any waiting room.
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

        const newPlayers = [pnames[0] || "Player", playerName];
        const newPlayerIds = [pids[0], playerId];

        const { data: joined, error: joinErr } = await sb
          .from("rooms")
          .update({ status: "playing", players: newPlayers, player_ids: newPlayerIds })
          .eq("id", cand.id)
          .eq("status", "waiting")
          .eq("player_ids", pids)
          .select("*")
          .maybeSingle();

        if (!joinErr && joined) {
          try {
            const ids = Array.isArray(joined.player_ids) ? joined.player_ids : [];
            if (ids.length) await sb.from("queue").delete().in("player_id", ids);
          } catch {}
          return res.status(200).json({ matched: true, room: joined });
        }
      }
    }

    return res.status(200).json({ matched: false });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
