# Filà ERP · Fase 1

Aplicación Angular 22 + Supabase para festeros, responsables familiares y permisos por filà. Incluye autenticación, recuperación de contraseña, roles y aislamiento en PostgreSQL. No contiene funcionalidades económicas.

## Requisitos e instalación

Node 24 LTS (ver `.node-version`), npm 11, Docker y Supabase CLI 2.75.0 o una versión compatible. El lockfile fija las dependencias. Cada tarea en la nube ya está aislada: trabajar en el checkout existente, sin crear worktrees.

```bash
npm ci
supabase start
cp .env.example .env
# Rellenar SUPABASE_URL y SUPABASE_ANON_KEY con la URL y clave pública locales.
npm run configure
npm start
```

Supabase aplica las migraciones al iniciar. `supabase status` muestra la configuración local; no copiar claves de servicio a `.env` ni a Angular. Crear la cuenta y la primera filà siguiendo [el bootstrap](docs/database.md). La app no introduce usuarios ni datos de demostración automáticamente. Sin configuración muestra una explicación en la pantalla de acceso; no simula autenticación.

La configuración del navegador se genera en `public/config.json` (ignorada en Git). Solo contiene URL y clave pública. Nunca incluir `service_role`. Al crear un build sin configuración se genera un archivo vacío para poder servir la pantalla de diagnóstico; configurar antes del build de producción.

Si el registro ECR está bloqueado y Docker Hub está permitido:

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start
```

En el entorno cloud con Docker `vfs`, preparar primero el CLI y una imagen local de una sola capa para no agotar disco:

```bash
bash scripts/install-supabase.sh
bash scripts/prepare-local-db-image.sh
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io /workspace/.tools/supabase-2.75.0/supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor
```

El helper verifica el checksum oficial de crane, fija la imagen de origen por digest y conserva su contenido/configuración de arranque. La imagen local cambia de manifiesto; no se publica ni modifica el registro oficial. En Docker con `overlay2` no hace esta transformación. Este ajuste es exclusivo del desarrollo local, no del despliegue en Supabase.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

Las pruebas SQL no necesitan Docker y comprueban RLS sobre PostgreSQL real embebido, con emulación del contexto Auth. Para la integración completa, usar una base **local y desechable**:

```bash
supabase start
# Guardar fuera de Git: contiene la clave privilegiada local.
supabase status -o env > /tmp/fila-local.env
node --env-file=/tmp/fila-local.env node_modules/@playwright/test/cli.js test
```

El runner crea cuentas temporales, datos de dos filàs y comprueba login, CRUD, baja, familias, restricciones y recuperación. Elimina los fixtures al terminar. Requiere Chromium (`/usr/bin/chromium` por defecto; ajustar `PLAYWRIGHT_CHROMIUM_EXECUTABLE` si hace falta) o instalar el navegador Playwright. Nunca apuntarlo a producción. Ver [resultados y límites](docs/validation.md).

## Estructura

- `src/app/core`: sesión, cliente Supabase, guards y contratos tipados compartidos.
- `src/app/shared`: cabeceras, estados, badges y confirmación accesible.
- `src/app/features`: rutas lazy de auth, inicio, festeros, familias y administración; formularios reactivos, signals, servicios y validadores por dominio.
- `supabase/migrations`: esquema, constraints, índices, RLS y auditoría versionados.
- `scripts/database.test.mjs`: pruebas SQL de seguridad.
- `e2e`: pruebas con navegador y Supabase local.

Consultar [arquitectura](docs/architecture.md), [modelo de datos](docs/database.md) y [seguridad/RGPD](docs/security.md).

## Cloudflare Pages y Supabase remoto

1. Crear un proyecto Supabase; aplicar migraciones revisadas, configurar Auth y hacer bootstrap.
2. Definir `SUPABASE_URL` y `SUPABASE_ANON_KEY` públicas en el entorno de build. Ejecutar `node scripts/configure.mjs && npm run build`.
3. Publicar `dist/fila-erp/browser` en Cloudflare Pages. Incluye fallback SPA y cabeceras de seguridad.
4. Configurar URL pública y `/auth` como redirección permitida en Supabase. Probar login y recuperación con SMTP real antes de abrir acceso.

No se ha desplegado ni publicado automáticamente en ningún servicio externo.
