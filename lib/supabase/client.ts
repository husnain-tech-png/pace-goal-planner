import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured. Add the public project URL and publishable key to .env.local.");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
