import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
// All sensitive API calls (LLM, market data) route through Supabase Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// When env vars are missing the app should still boot in demo mode.
// Use placeholder values so createClient never throws.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. The app will run in demo mode. Check your .env.local file.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);
