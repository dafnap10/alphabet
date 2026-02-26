import { createClient } from "@supabase/supabase-js";

function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { roomId } = req.body || {};
    if (!roomId) return res.status(400).json({ error: "Missing roomId" });

    const sb = getDB();

    // Fetch current room
    const { data: room, error: fetchErr } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const newLetter = randomLetter();

    // Reset room state for a new round
    const updatedRoom = {
      ...room,
      letter: newLetter,
      status: "playing",
      answers: {},
      validation: {}
    };

    const { error: upErr } = await sb.from("rooms").upsert(updatedRoom);
    if (upErr) return res.status(500).json({ error: upErr.message });

    // If this room is also a private lobby, update lobby letter (keep same players)
    await sb.from("lobbies").update({ letter: newLetter, status: "playing" }).eq("id", roomId);

    return res.status(200).json({ ok: true, room: updatedRoom });
  } catch (err) {
    console.error("rematch error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
