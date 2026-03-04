import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const fallbackUrl = 'http://127.0.0.1:54321';
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTY1NzEyMDB9.YW5vbi1rZXk=';

export const supabase = createBrowserClient(supabaseUrl ?? fallbackUrl, supabaseAnonKey ?? fallbackAnonKey, {
  isSingleton: true,
});

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured.');
  }
}
