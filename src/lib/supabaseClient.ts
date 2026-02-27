import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
// All sensitive API calls (LLM, market data) route through Supabase Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Track whether Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Auth features are disabled — demo mode is still available. Check your .env.local file.'
  );
}

// Use placeholder values when env vars are missing so createClient does not
// throw at module-load time (which causes a blank screen on Vercel).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
