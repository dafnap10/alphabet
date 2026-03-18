import { createClient } from "@supabase/supabase-js";

function randomLetter() {
  return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)];
}

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// Private rematch handshake:
// - Each player presses “Play Again” → we record a vote in rooms.rematch JSON
// - When BOTH players have voted → reset the room for a new round (same room id)
// This keeps both players in the same room and prevents desync when one restarts early.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { roomId, playerId } = req.body || {};
    if (!roomId) return res.status(400).json({ error: "Missing roomId" });
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getDB();

    // Fetch current room
    const { data: room, error: fetchErr } = await sb
      .from("rooms")
      .select("id, letter, players, player_ids, answers")
      .eq("id", roomId)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const pid = String(playerId).trim();
    const current = (room.answers && room.answers.__rematch) || {};
    const nextRematch = { ...current, [pid]: true };

    // Determine the two players we expect.
    // Prefer stable player_ids; fallback to players (names) if needed.
    const expected = Array.isArray(room.player_ids) && room.player_ids.length >= 2
      ? room.player_ids.filter(Boolean)
      : [];

    // If player_ids are missing for some reason, still allow rematch with 2 votes total.
    const allVoted = expected.length >= 2
      ? expected.every((p) => nextRematch[p])
      : Object.keys(nextRematch).length >= 2;

    if (!allVoted) {
      // Just store the vote and tell client we are waiting.
      const { error: upErr } = await sb
        .from("rooms")
        .update({ answers: { ...(room.answers || {}), __rematch: nextRematch } })
        .eq("id", roomId);
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.status(200).json({ ok: true, started: false });
    }

    const newLetter = randomLetter();

    // Reset room state for a new round. Keep same room id.
    const { error: resetErr } = await sb
      .from("rooms")
      .update({
        letter: newLetter,
        status: "playing",
        answers: {},
        validation: {},
      })
      .eq("id", roomId);

    if (resetErr) return res.status(500).json({ error: resetErr.message });

    // If this room is also a private lobby row (same id), keep lobby in playing.
    await sb.from("lobbies").update({ letter: newLetter, status: "playing" }).eq("id", roomId);

    // Return minimal room info
    return res.status(200).json({ ok: true, started: true, room: { id: roomId, letter: newLetter } });
  } catch (err) {
    console.error("rematch error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
