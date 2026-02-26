// pages/api/lobby.js — create or join a private lobby
import { createClient } from "@supabase/supabase-js";

const LETTERS_EN = "ABCDEFGHIJKLMNOPRSTW";
const LETTERS_HE = "אבגדהוזחטיכלמנסעפצקרשת";

function randomLetter(lang) {
  const pool = lang === "he" ? LETTERS_HE : LETTERS_EN;
  return pool[Math.floor(Math.random() * pool.length)];
}
function makeCode() {
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
  // GET — fetch lobby info for invite link landing (show host name)
  if (req.method === "GET") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });
    try {
      const sb = getDB();
      const { data, error } = await sb
        .from("lobbies")
        .select("id,host_name,status,lang")
        .eq("id", id.toUpperCase())
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Lobby not found" });
      return res.status(200).json({ host_name: data.host_name, status: data.status, lang: data.lang || "en" });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { action, lobbyCode, playerId, playerName, lang } = req.body || {};
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
        letter: randomLetter(lang),
        lang: lang || "en",
        status: "waiting",
        created_at: new Date().toISOString(),
      };
      const { error } = await sb.from("lobbies").insert(lobby);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ created: true, lobbyCode: code });
    }

    // ── JOIN ─────────────────────────────────────────────────────────────────
    if (action === "join") {
      if (!lobbyCode) return res.status(400).json({ error: "Missing lobbyCode" });

      const { data: lobby, error: fErr } = await sb
        .from("lobbies")
        .select("*")
        .eq("id", lobbyCode.toUpperCase())
        .maybeSingle();

      if (fErr) return res.status(500).json({ error: fErr.message });
      if (!lobby) return res.status(404).json({ error: "Lobby not found. Check the code and try again." });
      if (lobby.status !== "waiting") return res.status(409).json({ error: "This lobby is no longer available." });
      if (lobby.host_id === playerId) return res.status(400).json({ error: "You can't join your own lobby." });

      // Mark lobby as active + fill guest
      const { error: uErr } = await sb
        .from("lobbies")
        .update({ guest_id: playerId, guest_name: playerName, status: "active" })
        .eq("id", lobby.id);
      if (uErr) return res.status(500).json({ error: uErr.message });

      // Create or reuse a room for this pair
      const roomId = lobby.id; // use lobby code as room id (both players know it)
      const { data: existingRoom } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();

      let room = existingRoom;
      if (!room) {
        const { data: newRoom, error: rErr } = await sb.from("rooms").insert({
          id: roomId,
          letter: lobby.letter,
          status: "playing",
          players: [lobby.host_name, playerName],
          player_ids: [lobby.host_id, playerId],
          answers: {},
          validation: {},
          created_at: new Date().toISOString(),
        }).select("*").maybeSingle();
        if (rErr) return res.status(500).json({ error: rErr.message });
        room = newRoom;
      }

      return res.status(200).json({
        joined: true,
        room,
        opponentName: lobby.host_name,
        lang: lobby.lang || "en",
      });
    }

    // ── POLL (host waiting for guest) ────────────────────────────────────────
    if (action === "poll") {
      if (!lobbyCode) return res.status(400).json({ error: "Missing lobbyCode" });

      const { data: lobby, error: fErr } = await sb
        .from("lobbies")
        .select("*")
        .eq("id", lobbyCode.toUpperCase())
        .maybeSingle();

      if (fErr) return res.status(500).json({ error: fErr.message });
      if (!lobby) return res.status(404).json({ error: "Lobby not found" });
      if (lobby.status !== "active" || !lobby.guest_id) {
        return res.status(200).json({ ready: false });
      }

      const roomId = lobby.id;
      const { data: existingRoom } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();

      let room = existingRoom;
      if (!room) {
        const { data: newRoom, error: rErr } = await sb.from("rooms").insert({
          id: roomId,
          letter: lobby.letter,
          status: "playing",
          players: [playerName, lobby.guest_name],
          player_ids: [playerId, lobby.guest_id],
          answers: {},
          validation: {},
          created_at: new Date().toISOString(),
        }).select("*").maybeSingle();
        if (rErr) {
          // Room already exists (guest created it first) — fetch it
          const { data: retry } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
          room = retry;
        } else {
          room = newRoom;
        }
      }

      if (!room) return res.status(200).json({ ready: false });

      return res.status(200).json({
        ready: true,
        room,
        opponentName: lobby.guest_name,
        lang: lobby.lang || "en",
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("lobby.js error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
