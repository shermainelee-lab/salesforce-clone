// Public, client-safe defaults for the `salesforce-clone` Supabase project.
// The publishable key is designed to be exposed in browsers; Row Level Security protects the data.
// Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to point at a different project.
const DEFAULT_URL = "https://qupsqbdzuiiyblwqhjbp.supabase.co";
const DEFAULT_KEY = "sb_publishable_Xixr51DZ_oISX4_RVEZ4OA_xvFDVQcW";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;
  return { url, key };
}

export function hasSupabaseEnv() {
  const { url, key } = supabaseEnv();
  return Boolean(url && key);
}
