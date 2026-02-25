// pages/api/match-status.js
// Actively tries to match on every poll — fixes the race condition where
// both players join the queue simultaneously and nobody pairs them up.

import { createClient } from "@supabase/supabase-js";

function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }
function makeId() { return Math.random().toString(36).substring(2, 10); }

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getDB();

    // 1. Check if I'm still in the queue
    const { data: me } = await sb
      .from("queue").select("*").eq("player_id", playerId).maybeSingle();

    if (me) {
      // I'm still in the queue — try to actively match with someone else
      const { data: waiting } = await sb
        .from("queue").select("*")
        .neq("player_id", playerId)
        .order("joined_at", { ascending: true })
        .limit(1);

      const opponent = waiting?.[0];

      if (opponent) {
        // Remove BOTH of us from the queue
        await sb.from("queue").delete().in("player_id", [playerId, opponent.player_id]);

        // Create a room
        const roomId = makeId();
        const room = {
          id: roomId,
          letter: randomLetter(),
          status: "playing",
          players: [me.player_name, opponent.player_name],
          player_ids: [playerId, opponent.player_id],
          answers: {},
          validation: {}
        };

        const { error: insertErr } = await sb.from("rooms").insert(room);
        if (insertErr) return res.status(500).json({ error: "Room create failed: " + insertErr.message });

        return res.status(200).json({ matched: true, room });
      }

      // Nobody else in queue yet — still waiting
      return res.status(200).json({ matched: false });
    }

    // 2. Not in queue — find the room someone created for me
    const { data: room } = await sb
      .from("rooms").select("*")
      .contains("player_ids", [playerId])
      .eq("status", "playing")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (room) return res.status(200).json({ matched: true, room });

    // Removed from queue but room not found yet — keep polling
    return res.status(200).json({ matched: false });

  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
