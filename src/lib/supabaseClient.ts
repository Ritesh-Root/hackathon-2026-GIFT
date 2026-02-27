import { createClient } from '@supabase/supabase-js';

// Read from Vite env — these are public/publishable keys, safe for the frontend.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// True only when real Supabase credentials are provided
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase URL or Anon Key is missing. Running in demo mode without auth/database.'
  );
}

// Use placeholder values when unconfigured so createClient never throws
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
