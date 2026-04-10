import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                   (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL ||
                   (import.meta.env as any).SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                      (import.meta.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                      (import.meta.env as any).SUPABASE_ANON_KEY;

// Fallback to non-VITE prefixed if available (rare in browser but good for consistency)
const finalUrl = supabaseUrl || '';
const finalKey = supabaseAnonKey || '';

if (!finalUrl || !finalKey) {
  const msg = 'Supabase configuration is missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.';
  console.error(msg);
}

export const supabase = createClient(
  finalUrl || 'https://missing-config.supabase.co',
  finalKey || 'missing-key'
);
