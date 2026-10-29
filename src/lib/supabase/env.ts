/**
 * Resolve public Supabase credentials.
 * Prefer NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (current docs).
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted as a legacy alias for the same public key.
 */

export function isSupabaseEnvPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    v.includes("your_project_ref") ||
    v.includes("your-project") ||
    v === "sb_publishable_..." ||
    v.endsWith("...") ||
    v.includes("example.com") ||
    v.includes("placeholder")
  );
}

export function tryGetSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) return null;
  if (isSupabaseEnvPlaceholder(url) || isSupabaseEnvPlaceholder(key)) return null;
  return { url, key };
}

export function getSupabasePublicEnv(): { url: string; key: string } {
  const env = tryGetSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY). See .env.example.",
    );
  }
  return env;
}
