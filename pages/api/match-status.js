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

    // 1. Check if a room was already assigned to me via the lookup table
    const { data: lookup } = await sb
      .from("player_rooms").select("room_id").eq("player_id", playerId).maybeSingle();

    if (lookup?.room_id) {
      const { data: room } = await sb.from("rooms").select("*").eq("id", lookup.room_id).maybeSingle();
      if (room) return res.status(200).json({ matched: true, room });
    }

    // 2. Still in queue — try to actively match with someone else
    const { data: me } = await sb
      .from("queue").select("*").eq("player_id", playerId).maybeSingle();

    if (me) {
      const { data: waiting } = await sb
        .from("queue").select("*").neq("player_id", playerId)
        .order("joined_at", { ascending: true }).limit(1);

      const opponent = waiting?.[0];
      if (opponent) {
        // Remove both from queue
        await sb.from("queue").delete().in("player_id", [playerId, opponent.player_id]);

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

        const { error: roomErr } = await sb.from("rooms").insert(room);
        if (roomErr) return res.status(500).json({ error: "Room error: " + roomErr.message });

        // Write lookup entries for both players
        await sb.from("player_rooms").upsert([
          { player_id: playerId,           room_id: roomId },
          { player_id: opponent.player_id, room_id: roomId }
        ]);

        return res.status(200).json({ matched: true, room });
      }
      // Nobody else waiting yet
      return res.status(200).json({ matched: false });
    }

    // Not in queue and no room found yet — keep polling briefly
    return res.status(200).json({ matched: false });

  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
