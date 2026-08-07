// Cliente de Supabase compartido por toda la app.
// Lee la URL y la clave pública ("anon key") desde variables de entorno
// de Vite (deben empezar por VITE_ para que el navegador pueda verlas).
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellénalas.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
