export default function handler(req, res) {
  return res.status(200).json({
    SUPABASE_URL:              process.env.SUPABASE_URL              ? "✓ set" : "✗ MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ set" : "✗ MISSING",
    NEXT_PUBLIC_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL  ? "✓ set" : "✗ MISSING",
    ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY         ? "✓ set" : "✗ MISSING",
  });
}
