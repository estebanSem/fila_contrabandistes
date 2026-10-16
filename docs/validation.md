# Validación de fase 1

Validado en esta instancia cloud con Node 24.19.0, npm 11.9.0, Angular 22.2, Supabase CLI 2.75.0 y PostgreSQL 17. Las pruebas usan datos temporales, no datos reales.

| Comprobación                                    | Resultado                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Instalación desde lockfile (`npm ci`)           | Correcta                                                             |
| ESLint                                          | Sin errores                                                          |
| Type checking estricto de aplicación y E2E      | Correcto                                                             |
| Angular / Vitest                                | 15 tests aprobados, 4 archivos                                       |
| Migración y RLS / PGlite                        | 16 tests aprobados                                                   |
| Playwright + Supabase Auth/PostgREST/PostgreSQL | 6 escenarios aprobados en una ejecución completa                     |
| Build de producción                             | Correcto; bundle inicial 484,65 kB, estimado 119,44 kB transferidos  |
| Auditoría npm de dependencias de ejecución      | 0 vulnerabilidades detectadas                                        |
| axe WCAG 2 A/AA y 2.1 AA en listado móvil       | 0 incidencias automáticas detectadas en esa vista                    |
| Smoke local                                     | Auth saludable, API operativa y lectura anónima del padrón rechazada |

**37 tests aprobados** entre las tres suites; sin tests omitidos en estas ejecuciones.

## Cobertura funcional comprobada

- Login y logout; restauración de sesión tras recargar una ruta protegida.
- Recuperación solicitada desde la interfaz, recepción del correo en Mailpit, apertura en el mismo navegador mediante PKCE, cambio de contraseña y nuevo login.
- Alta, edición, consulta y baja lógica de festeros desde Chromium con viewport móvil; búsqueda y filtro de menores en servidor.
- Creación y finalización de relaciones; un menor no necesita cuenta.
- Un festero ve su ficha y dependiente autorizado; pierde acceso al revocarse la relación y recargar. Las fechas futuras/vencidas se comprueban también en SQL.
- Rutas administrativas bloqueadas para el rol FESTERO; lectura directa de un UUID ajeno rechazada.
- Dos filàs con usuarios distintos: lectura cruzada vacía y escritura con tenant falsificado rechazada por PostgREST/RLS. SQL comprueba además tablas de pertenencias, roles, familias y auditoría, FK compuestas y ausencia de escalada de privilegios.
- Asignación y revocación de roles desde administración, auditoría visible y protección del último administrador.
- Validaciones de fechas, nacimiento, responsables adultos, baja y contactos; el cálculo del filtro de edad contempla años bisiestos.

Los fixtures se eliminan al finalizar. Las pruebas E2E rechazan proyectos remotos y no deben usarse como herramienta de carga de datos reales.

## Entorno reproducible

El registro ECR estaba bloqueado y se utilizó el selector oficial `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. Docker utiliza `vfs`; la imagen de PostgreSQL por capas agotó disco durante el primer intento. El helper de preparación descarga una imagen fijada por digest y fusiona su filesystem en una sola capa local, preservando la configuración de arranque. Los binarios se verifican mediante los checksums oficiales y se mantiene TLS. Se comprobó el arranque y un ciclo de parada/restauración de Supabase. Esto no altera ni publica imágenes en el registro oficial.

Las instrucciones `install_script` y `start_skill` están guardadas en el borrador del entorno. Guardar ese borrador no lo publica ni acredita la restauración en una tarea nueva. Los servicios de esta instancia no deben asumirse persistentes tras publicación o reinicio; las instrucciones los arrancan de nuevo.

## Límites y deuda técnica

- No se ha desplegado en Cloudflare Pages ni en Supabase remoto. Faltan la configuración de ese proyecto, SMTP de producción, redirecciones y el bootstrap de cuentas reales; el procedimiento está en README y database.md.
- Los tipos de base de datos están mantenidos explícitamente junto al contrato inicial. Automatizar su generación y comparación en CI cuando evolucione el esquema.
- El selector familiar carga el padrón autorizado; para filàs grandes conviene sustituirlo por autocomplete paginado. El listado principal ya usa paginación de 25 filas en servidor.
- La auditoría automática de accesibilidad cubre una vista y se revisó su presentación móvil; no equivale a una certificación WCAG completa.
- El workflow CI está creado, pero no se ha ejecutado en GitHub desde esta tarea. Las comprobaciones indicadas se ejecutaron en la máquina cloud.
- Exportación, anonimización, consentimientos y funcionalidades económicas permanecen fuera de fase 1 conforme al alcance. No se presentan como funcionalidades operativas.
