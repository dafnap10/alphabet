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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { playerId, playerName } = req.body || {};
    if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });

    const sb = getDB();

    // Check if already matched (re-entry after page refresh)
    const { data: existing } = await sb
      .from("player_rooms").select("room_id").eq("player_id", playerId).maybeSingle();
    if (existing?.room_id) {
      const { data: room } = await sb.from("rooms").select("*").eq("id", existing.room_id).maybeSingle();
      if (room) {
        const opp = (room.players || []).find(p => p !== playerName) || "Opponent";
        return res.status(200).json({ matched: true, room, opponentName: opp });
      }
    }

    // Upsert into queue
    const { error: qErr } = await sb.from("queue").upsert({
      player_id: playerId, player_name: playerName, joined_at: new Date().toISOString()
    });
    if (qErr) return res.status(500).json({ error: "Queue error: " + qErr.message });

    // Try atomic match via DB function
    const { data, error: rpcErr } = await sb.rpc("try_match_player", { p_player_id: playerId });

    if (!rpcErr && data?.matched) {
      const { data: room } = await sb.from("rooms").select("*").eq("id", data.room_id).maybeSingle();
      if (room) {
        const opp = (room.players || []).find(p => p !== playerName) || "Opponent";
        return res.status(200).json({ matched: true, room, opponentName: opp });
      }
    }

    // Nobody to match yet — client will poll match-status
    return res.status(200).json({ matched: false });

  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
