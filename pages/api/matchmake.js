// pages/api/matchmake.js
import { getSupabaseAdmin } from "../../lib/supabase";

function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }
function makeId() { return Math.random().toString(36).substring(2, 10); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { playerId, playerName } = req.body;
  if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });

  const sb = getSupabaseAdmin();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 90_000).toISOString(); // 90s ago

  // 1. Clean up stale queue entries
  await sb.from("queue").delete().lt("joined_at", staleThreshold);

  // 2. Find a waiting opponent (not me)
  const { data: waiting } = await sb
    .from("queue")
    .select("*")
    .neq("player_id", playerId)
    .order("joined_at", { ascending: true })
    .limit(1);

  const opponent = waiting?.[0];

  if (opponent) {
    // Remove opponent from queue
    await sb.from("queue").delete().eq("player_id", opponent.player_id);

    // Create a room for both
    const roomId = makeId();
    const room = {
      id: roomId,
      letter: randomLetter(),
      status: "playing",
      players: [opponent.player_name, playerName],
      player_ids: [opponent.player_id, playerId],
      answers: {},
      validation: {}
    };

    const { error } = await sb.from("rooms").insert(room);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ matched: true, room, opponentName: opponent.player_name });
  } else {
    // Add me to queue (upsert in case of re-entry)
    await sb.from("queue").upsert({
      player_id: playerId,
      player_name: playerName,
      joined_at: now.toISOString()
    });

    return res.status(200).json({ matched: false });
  }
}
