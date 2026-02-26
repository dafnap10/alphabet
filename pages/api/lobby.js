// pages/api/lobby.js — create or join a private lobby
import { createClient } from "@supabase/supabase-js";

function randomLetter() { return "ABCDEFGHIJKLMNOPRSTW"[Math.floor(Math.random() * 20)]; }
function makeCode() {
  // 6-char uppercase code, easy to read
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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
    const { action, lobbyCode, playerId, playerName } = req.body || {};
    if (!playerId || !playerName) return res.status(400).json({ error: "Missing fields" });
    const sb = getDB();

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const code = makeCode();
      const lobby = {
        id: code,
        host_id: playerId,
        host_name: playerName,
        guest_id: null,
        guest_name: null,
        letter: randomLetter(),
        status: "waiting",
        created_at: new Date().toISOString()
      };
      const { error } = await sb.from("lobbies").insert(lobby);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ created: true, lobbyCode: code });
    }

    // ── JOIN ─────────────────────────────────────────────────────────────────
    if (action === "join") {
      if (!lobbyCode) return res.status(400).json({ error: "Missing lobbyCode" });
      const code = lobbyCode.trim().toUpperCase();

      const { data: lobby, error: fetchErr } = await sb
        .from("lobbies").select("*").eq("id", code).maybeSingle();

      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!lobby)   return res.status(404).json({ error: "Lobby not found. Check the code." });
      if (lobby.status !== "waiting") return res.status(400).json({ error: "This lobby already started." });
      if (lobby.host_id === playerId)  return res.status(400).json({ error: "You created this lobby — share it with a friend!" });

      // Join the lobby
      const { error: updateErr } = await sb.from("lobbies").update({
        guest_id: playerId,
        guest_name: playerName,
        status: "playing"
      }).eq("id", code);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      // Build room object in same shape as matchmaking rooms
      const room = {
        id: code,
        letter: lobby.letter,
        status: "playing",
        players: [lobby.host_name, playerName],
        player_ids: [lobby.host_id, playerId],
        answers: {},
        validation: {}
      };

      // Upsert into rooms table so polling works
      await sb.from("rooms").upsert(room);

      // Lookup entries for both
      await sb.from("player_rooms").upsert([
        { player_id: lobby.host_id, room_id: code },
        { player_id: playerId,      room_id: code }
      ]);

      return res.status(200).json({ joined: true, room, opponentName: lobby.host_name });
    }

    // ── POLL (host waiting for guest) ─────────────────────────────────────
    if (action === "poll") {
      if (!lobbyCode) return res.status(400).json({ error: "Missing lobbyCode" });
      const { data: lobby } = await sb
        .from("lobbies").select("*").eq("id", lobbyCode).maybeSingle();

      if (!lobby) return res.status(404).json({ error: "Lobby not found" });

      if (lobby.status === "playing" && lobby.guest_id) {
        const room = {
          id: lobbyCode,
          letter: lobby.letter,
          status: "playing",
          players: [lobby.host_name, lobby.guest_name],
          player_ids: [lobby.host_id, lobby.guest_id],
          answers: {},
          validation: {}
        };
        // Ensure room + lookup exist for host too
        await sb.from("rooms").upsert(room);
        await sb.from("player_rooms").upsert([
          { player_id: lobby.host_id,  room_id: lobbyCode },
          { player_id: lobby.guest_id, room_id: lobbyCode }
        ]);
        return res.status(200).json({ ready: true, room, opponentName: lobby.guest_name });
      }

      return res.status(200).json({ ready: false });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("lobby error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
