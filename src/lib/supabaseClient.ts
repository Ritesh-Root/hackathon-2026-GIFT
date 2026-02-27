import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
// All sensitive API calls (LLM, market data) route through Supabase Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// True when real Supabase credentials are provided.
// When false the app runs in demo mode — auth, chat, and portfolio features are disabled.
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Running in demo mode. Check your .env.local file.'
  );
}

// Use placeholder values when env vars are missing so createClient doesn't throw.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
