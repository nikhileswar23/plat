import { createClient } from '@supabase/supabase-js';
export const BUCKET = 'property-files';
const u = import.meta.env.VITE_SUPABASE_URL, k = import.meta.env.VITE_SUPABASE_KEY;
export const sb = u && k ? createClient(u, k) : null;
