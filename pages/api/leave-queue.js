// pages/api/leave-queue.js
import { getSupabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();
    await sb.from("queue").delete().eq("player_id", playerId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("leave-queue error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
