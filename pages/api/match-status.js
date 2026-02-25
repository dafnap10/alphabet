// pages/api/match-status.js
import { getSupabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Check if I'm still in the queue
    const { data: inQueue } = await sb
      .from("queue")
      .select("player_id")
      .eq("player_id", playerId)
      .maybeSingle();

    if (inQueue) return res.status(200).json({ matched: false });

    // Not in queue — find my room
    const { data: room } = await sb
      .from("rooms")
      .select("*")
      .contains("player_ids", [playerId])
      .eq("status", "playing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (room) return res.status(200).json({ matched: true, room });

    return res.status(200).json({ matched: false });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
