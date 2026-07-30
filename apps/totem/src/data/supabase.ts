import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

/** Cliente único, role anon. Não há login no totem. */
export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
