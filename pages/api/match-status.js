import { createClient } from "@supabase/supabase-js";

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

    // 1. Check if a room was already created for me
    const { data: lookup } = await sb
      .from("player_rooms").select("room_id").eq("player_id", playerId).maybeSingle();

    if (lookup?.room_id) {
      const { data: room } = await sb.from("rooms").select("*").eq("id", lookup.room_id).maybeSingle();
      if (room) return res.status(200).json({ matched: true, room });
    }

    // 2. Try to match atomically via DB function — prevents race conditions
    const { data, error } = await sb.rpc("try_match_player", { p_player_id: playerId });

    if (error) {
      // Function doesn't exist yet or other error — fall through
      console.error("rpc error:", error.message);
    } else if (data?.matched) {
      const { data: room } = await sb.from("rooms").select("*").eq("id", data.room_id).maybeSingle();
      if (room) return res.status(200).json({ matched: true, room });
    }

    return res.status(200).json({ matched: false });

  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
