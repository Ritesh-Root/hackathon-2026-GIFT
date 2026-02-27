import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
// All sensitive API calls (LLM, market data) route through Supabase Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Use placeholder values when env vars are missing so the app doesn't crash.
// Supabase features will be unavailable, but the rest of the app (demo mode,
// market data via Vercel API / Yahoo proxy) will still work.
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Running in demo mode without Supabase.'
  );
}

export { isSupabaseConfigured };

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
