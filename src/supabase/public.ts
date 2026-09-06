import { createClient } from "@supabase/supabase-js";

/** Anon-key client for public, RLS-gated reads (naics_codes). Reads
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from whichever
 * app is running this. */
export function getSupabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
