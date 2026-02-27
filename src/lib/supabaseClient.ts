import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
// All sensitive API calls (LLM, market data) route through Supabase Edge Functions.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Check your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
