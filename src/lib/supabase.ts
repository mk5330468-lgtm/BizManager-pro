import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Supabase configuration is missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.';
  console.error(msg);
  if (typeof window !== 'undefined') {
    console.warn('Note: Environment variables for the browser must be prefixed with VITE_');
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-config.supabase.co',
  supabaseAnonKey || 'missing-key'
);
