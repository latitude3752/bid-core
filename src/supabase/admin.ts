import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client: bypasses RLS. Server-only — never import from a Client Component.
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from whichever app is running this --
 * each app's own Vercel project sets these to its own Supabase project's values. */
export function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
