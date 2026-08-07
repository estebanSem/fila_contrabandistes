# Cuotas Filà — Paso 1: Autenticación y registro de festeros

Coste: 0 €. React + Supabase, sin servidor propio.

## Qué incluye este paso

- Página única con dos pestañas: **Iniciar sesión** / **Crear cuenta**.
- El registro crea una cuenta de Supabase Auth y, a través de la función
  `registrar_festero()` (ejecutada dentro de PostgreSQL), guarda la ficha
  del festero en la tabla `fester`, vinculada a esa cuenta por `auth_id`.
- Tras iniciar sesión, un Dashboard mínimo confirma que todo el circuito
  funciona: lee la propia ficha del festero protegida por Row Level Security.
- Lo que vendrá en próximos pasos: selección de actos, cálculo de tarifas
  (tabla `tarifa`), y registro de pagos (`pagos_tarifas`) — las tablas ya
  están creadas en `schema.sql`, pero el frontend de ese flujo aún no.

## 1. Base de datos

1. En Supabase: **SQL Editor → New query**, pega todo `schema.sql` y **Run**.
   (Corrige dos bugs de la función que me pasaste: faltaba la columna
   `auth_id` en `fester` y el `then` en `when others`; están explicados
   como comentarios dentro del propio archivo.)
2. Copia tus credenciales en **Project Settings → API**:
   `Project URL` → `VITE_SUPABASE_URL`, `anon public key` → `VITE_SUPABASE_ANON_KEY`.

## 2. Probarlo en local / Codespaces

```bash
npm install
cp .env.example .env   # rellena con tus credenciales reales
npm run dev
```

Abre la URL que indique Vite (en Codespaces, mira la pestaña **PORTS** →
puerto 5173 → ábrelo, y ponlo en **Public** si te pide login de GitHub).

## 3. Nota sobre la confirmación de email

Por defecto, Supabase exige confirmar el email antes de poder iniciar sesión.
Si quieres probar rápido sin configurar el envío de emails: **Authentication →
Providers → Email → desactiva "Confirm email"** (solo para desarrollo/pruebas;
actívalo de nuevo antes de abrir el formulario a festeros reales).

## 4. Desplegarlo gratis (Vercel o Netlify)

Igual que en la versión anterior: sube el repo a GitHub, conéctalo en
Vercel o Netlify, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
como variables de entorno, y despliega.
