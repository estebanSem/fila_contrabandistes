import { writeFileSync } from 'node:fs';
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY');
const url = new URL(SUPABASE_URL);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Supabase requiere HTTPS');
writeFileSync(
  'public/config.json',
  JSON.stringify({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }),
);
