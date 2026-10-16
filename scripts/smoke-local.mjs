import { createClient } from '@supabase/supabase-js';
const url = process.env.API_URL ?? process.env.SUPABASE_URL;
const key = process.env.ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Falta la configuración pública local');
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Este smoke test requiere Supabase local');
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
if (!health.ok) throw new Error('Auth no está disponible');
const anonymous = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const result = await anonymous.from('festero').select('id').limit(1);
if (result.error?.code !== '42501')
  throw new Error('La API no está disponible o permite acceso anónimo inesperado');
console.log('Auth saludable; API operativa; acceso anónimo al padrón rechazado.');
