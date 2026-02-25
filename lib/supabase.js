import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Supabase env vars missing. Got SUPABASE_URL=${url ? "✓" : "MISSING"}, SUPABASE_SERVICE_ROLE_KEY=${key ? "✓" : "MISSING"}`
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}
