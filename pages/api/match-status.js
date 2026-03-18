import { getSupabaseAdmin } from "../../lib/supabase";
import crypto from "crypto";

const LETTERS_EN = "ABCDEFGHIJKLMNOPRSTW";
const LETTERS_HE = "אבגדהוזחטיכלמנסעפצקרשת";

function randomLetter(lang) {
  const pool = lang === "he" ? LETTERS_HE : LETTERS_EN;
  return pool[Math.floor(Math.random() * pool.length)];
}
function stableRoomId(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return crypto.createHash("sha1").update(`${x}:${y}`).digest("hex").slice(0, 12);
}
function nowMinusMinutes(min) {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Prevent browser/CDN caching — every poll must hit the server
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  // Prevent browser/CDN caching — 304 responses break matchmaking polling
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  try {
    const { playerId, playerName, lang } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Cleanup stale queue rows
    try { await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30)); } catch {}

    // STEP 1: Already in an active room with 2 players?
    const { data: mine } = await sb
      .from("rooms")
      .select("*")
      .eq("status", "playing")
      .filter("player_ids", "cs", `["${playerId}"]`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine?.[0]) {
      const room = mine[0];
      if (Array.isArray(room.player_ids) && room.player_ids.length >= 2) {
        // Clean up queue just in case
        try { await sb.from("queue").delete().in("player_id", room.player_ids); } catch {}
        return res.status(200).json({ matched: true, room });
      }
    }

    // STEP 2: Am I in the queue?
    const { data: meQ } = await sb
      .from("queue")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();

    if (!meQ) {
      // Not in queue — check one more time if a room was created for us
      // (leader may have removed us from queue and created the room simultaneously)
      const { data: lateRoom } = await sb
        .from("rooms")
        .select("*")
        .eq("status", "playing")
        .filter("player_ids", "cs", `["${playerId}"]`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lateRoom?.[0] && Array.isArray(lateRoom[0].player_ids) && lateRoom[0].player_ids.length >= 2) {
        return res.status(200).json({ matched: true, room: lateRoom[0] });
      }

      // No room found — re-enqueue
      const myName = (playerName && String(playerName).trim()) || "Player";
      try {
        const r1 = await sb.from("queue").upsert({
          player_id: playerId, player_name: myName,
          lang: lang || "en", joined_at: new Date().toISOString(),
        });
        if (r1.error) {
          await sb.from("queue").upsert({
            player_id: playerId, player_name: myName,
            joined_at: new Date().toISOString(),
          });
        }
      } catch {}
      return res.status(200).json({ matched: false, queued: true });
    }

    const myName = meQ.player_name || (playerName && String(playerName).trim()) || "Player";
    const myLang = meQ.lang || lang || "en";

    // STEP 3: Fetch the 2 oldest queue entries
    const { data: q2 } = await sb
      .from("queue")
      .select("*")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (!q2 || q2.length < 2) return res.status(200).json({ matched: false, queued: true });

    const leader = q2[0];
    const opp    = q2[1];

    // Only the LEADER creates the room — the follower just waits
    if (leader.player_id !== playerId) {
      return res.status(200).json({ matched: false, queued: true });
    }

    const oppId   = opp.player_id;
    const oppName = opp.player_name || "Opponent";
    const roomId  = stableRoomId(playerId, oppId);

    // STEP 4: Create room (idempotent — if already exists, fetch it)
    const insert = {
      id: roomId,
      letter: randomLetter(myLang),
      status: "playing",
      players: [myName, oppName],
      player_ids: [playerId, oppId],
      answers: {},
      validation: {},
      created_at: new Date().toISOString(),
    };

    let room = null;
    const { data: created, error: cErr } = await sb.from("rooms").insert(insert).select("*").maybeSingle();
    if (cErr) {
      // Room already exists (duplicate leader poll) — just fetch it
      const { data: existing } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
      room = existing || null;
    } else {
      room = created || null;
    }

    if (!room) return res.status(200).json({ matched: false, queued: true });

    // STEP 5: Remove BOTH players from queue AFTER room is confirmed visible
    // The follower will find the room in STEP 1 on their next poll
    try { await sb.from("queue").delete().in("player_id", [playerId, oppId]); } catch {}

    return res.status(200).json({ matched: true, room });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
