# Seguridad y protección de datos

## Matriz de autorización

| Operación                           | Administrador | Junta | Tesorero | Festero                                 |
| ----------------------------------- | ------------- | ----- | -------- | --------------------------------------- |
| Leer festeros y familias de su filà | Sí            | Sí    | No       | Ficha propia y dependientes autorizados |
| Crear/editar/baja lógica de festero | Sí            | Sí    | No       | No                                      |
| Crear/editar/finalizar relaciones   | Sí            | Sí    | No       | No                                      |
| Vincular cuentas / asignar roles    | Sí            | No    | No       | No                                      |
| Leer auditoría                      | Sí            | No    | No       | No                                      |

Ningún rol accede a datos de otra filà. Las pertenencias sin rol FESTERO no otorgan acceso a fichas. La lectura de dependientes exige autorización y fechas vigentes. Revocar o finalizar la relación elimina ese acceso en la siguiente consulta. No hay permisos anónimos sobre las tablas. La protección del navegador es solo UX: RLS es la autoridad.

Las funciones de autorización son SECURITY DEFINER, con `search_path` vacío, sin SQL dinámico y permisos explícitos de ejecución. El esquema privado no se expone mediante PostgREST. Los triggers validan edades y registran operaciones. Los clientes no pueden modificar auditoría ni borrar festeros. La política de baja conserva la persona y posibles historiales futuros.

## Configuración de producción

- HTTPS obligatorio salvo localhost. Configurar Site URL y redirect URLs exactas `/auth` en Supabase Auth; no usar comodines de producción.
- Desactivar registro público si las altas son por invitación. Configurar SMTP real, límites de envío, contraseñas de al menos 12 caracteres, protección contra contraseñas filtradas y MFA para administradores según necesidades de la organización.
- La URL y clave `anon`/publishable son públicas. Las claves privilegiadas, contraseña PostgreSQL y tokens CLI son secretos y nunca se entregan al cliente. `.env` y configuración runtime generada están ignoradas en Git.
- La sesión usa el almacenamiento gestionado por Supabase JS y tokens renovables. La recuperación usa PKCE y requiere abrir el correo en el navegador que la solicitó; los enlaces inválidos muestran un error sin exponer sus tokens. Cualquier XSS podría comprometerla: Angular escapa interpolaciones, no se emplean `innerHTML` ni bypasses de sanitización. Cloudflare sirve CSP y cabeceras defensivas desde `public/_headers`. Ajustar `connect-src` si se usa dominio propio de Supabase.
- No se habilitan buckets de Storage: no existe necesidad funcional de ficheros en esta fase. Antes de añadirlos, crear bucket privado y políticas tenant por objeto en una nueva migración.
- Configurar backups, restauraciones ensayadas y alertas en Supabase antes de utilizar datos reales. Las pruebas locales no acreditan un despliegue de producción.

## RGPD

Finalidad: gestión de pertenencia y responsabilidad familiar. Contactos y documento son opcionales; no recogerlos sin necesidad y base jurídica. La filà debe definir información a interesados, responsables del tratamiento, acuerdos con proveedores, plazos de conservación, acceso y procedimientos de ejercicio de derechos. La autorización de relación familiar no equivale a consentimiento RGPD.

Solo los responsables autorizados ven datos de sus dependientes; no se publican padrones. La auditoría conserva IDs y operaciones, sin snapshots sensibles. Los UUID siguen siendo datos seudonimizados: limitar su conservación y acceso. La baja no equivale a supresión. Exportación y anonimización se implementarán mediante operaciones privilegiadas y auditadas, tras validar identidad, base jurídica y conservación; no se incluyen endpoints incompletos ni acciones irreversibles en esta fase.

## Límites conocidos

El panel de administración permite vincular cuentas ya creadas, no invitar por correo desde Angular. La revocación de permisos se aplica en PostgreSQL inmediatamente; la navegación puede conservar opciones hasta refrescar contexto, sin conceder acceso backend. Se debe realizar revisión de seguridad independiente y pruebas de carga antes de producción.
