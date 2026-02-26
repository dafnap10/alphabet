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

  try {
    const { playerId, playerName, lang } = req.query;
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });

    const sb = getSupabaseAdmin();

    // Cleanup stale queue rows
    try { await sb.from("queue").delete().lt("joined_at", nowMinusMinutes(30)); } catch {}

    // 1) Already in an active room with 2 players?
    const { data: mine } = await sb
      .from("rooms")
      .select("*")
      .contains("player_ids", [playerId])
      .eq("status", "playing")
      .order("created_at", { ascending: false })
      .limit(1);

    if (mine?.[0]) {
      const room = mine[0];
      if (Array.isArray(room.player_ids) && room.player_ids.length >= 2) {
        try {
          await sb.from("queue").delete().in("player_id", room.player_ids);
        } catch {}
        return res.status(200).json({ matched: true, room });
      }
    }

    // 2) Ensure I'm in queue — read my row
    const { data: meQ } = await sb
      .from("queue")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();

    if (!meQ) {
      // Was removed (race) — re-add with fallback for missing lang column
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

    // 3) Fetch oldest 2 queue entries
    const { data: q2 } = await sb
      .from("queue")
      .select("*")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (!q2 || q2.length < 2) return res.status(200).json({ matched: false, queued: true });

    const leader = q2[0];
    const opp    = q2[1];

    // Only the leader (oldest) creates the room — second player just waits
    if (leader.player_id !== playerId) {
      return res.status(200).json({ matched: false, queued: true });
    }

    const oppId   = opp.player_id;
    const oppName = opp.player_name || "Opponent";
    const roomId  = stableRoomId(playerId, oppId);

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
      // Room likely already exists (retry) — just fetch it
      const { data: existing } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
      room = existing || null;
    } else {
      room = created || null;
    }

    if (!room) return res.status(200).json({ matched: false, queued: true });

    // Clean up both players from queue
    try { await sb.from("queue").delete().in("player_id", [playerId, oppId]); } catch {}

    return res.status(200).json({ matched: true, room });
  } catch (err) {
    console.error("match-status error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
