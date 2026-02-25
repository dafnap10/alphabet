// pages/api/room.js
import { getSupabaseAdmin } from "../../lib/supabase";

export default async function handler(req, res) {
  try {
    const sb = getSupabaseAdmin();

    if (req.method === "GET") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const { data, error } = await sb.from("rooms").select("*").eq("id", id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Room not found" });
      return res.status(200).json(data);
    }

    if (req.method === "PATCH") {
      const { id, playerName, answers, validation } = req.body || {};
      if (!id || !playerName) return res.status(400).json({ error: "Missing fields" });

      const { data: room, error: fetchErr } = await sb.from("rooms").select("*").eq("id", id).maybeSingle();
      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!room) return res.status(404).json({ error: "Room not found" });

      const updatedAnswers    = { ...(room.answers    || {}), [playerName]: answers    };
      const updatedValidation = { ...(room.validation || {}), [playerName]: validation };

      const { error } = await sb
        .from("rooms")
        .update({ answers: updatedAnswers, validation: updatedValidation })
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("room error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
