# Filà Contrabandistes — festeros y cuotas

Aplicación React + Vite + Supabase para una filà. El festero se registra, gestiona hijos a cargo, selecciona tarifas por acto, crea una orden de transferencia y consulta los pagos familiares. Administración mantiene festeros, actos y tarifas, confirma pagos y concilia movimientos bancarios.

## Desarrollo

```bash
npm ci
cp .env-example .env
# Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
```

La clave `anon` es pública; nunca pongas la `service_role` en Vite. Entradas independientes: `/`, `/admin.html` y `/reset-password.html`.

## Cambio de base de datos requerido

La migración [`supabase/migrations/20260929_erp_guardrails.sql`](supabase/migrations/20260929_erp_guardrails.sql) debe aplicarse **antes de desplegar este frontend**. Trabaja primero sobre una copia de la base real y comprueba los nombres y tipos de columnas: el esquema original y las definiciones de `crear_pago` no están versionados en este repositorio. Haz copia de seguridad antes de ejecutar la migración en producción. El archivo se ejecuta como una transacción y no borra datos existentes.

La migración añade `activo`, políticas RLS, registro vinculado al usuario autenticado, funciones de archivado y conciliación con auditoría. Revoca el acceso de navegador a las RPC antiguas `registrar_festero`, `mostrar_cuotas` y `conciliar_pagos_cuotas`. Mantiene `crear_pago`, pero sus inserciones quedan sujetas a triggers que verifican responsable, hijo, tarifa, importe y total. **Revisa el cuerpo de `crear_pago` existente** antes de publicarlo: debe crear cabecera y detalles en una transacción, devolver el IBAN/BIC legítimos, asignar un concepto único y no modificar otras tablas de forma inesperada. También verifica que no haya otras funciones `SECURITY DEFINER` expuestas que alteren pagos o roles.

Comprobaciones en staging con al menos dos cuentas ordinarias y una administradora:

1. Una persona solo puede leer y modificar sus hijos; no puede cambiar `es_socio` ni `es_admin`, consultar otras familias, archivar otros festeros o confirmar pagos.
2. Un admin puede editar y archivar sin perder `detalle_pago` ni `pagos_cuotas`. Confirma un pago y revisa `auditoria_pagos`; un segundo intento debe fallar.
3. Previsualiza movimientos válidos, repetidos, con importe erróneo y ya pagados. Solo se aplican coincidencias pendientes de concepto único e importe exacto.
4. Crea una cuenta con confirmación de correo, confírmala e inicia sesión. La ficha se completa en el primer acceso. Comprueba también una ficha creada antes por admin con el mismo email verificado y DNI.
5. Comprueba que `crear_pago` rechaza cuotas ajenas, desactivadas o repetidas, y que el historial familiar muestra los pagos pendientes tras recargar.

## Alcance actual

Es una aplicación para **una filà**. No se ha añadido `fila_id` ni aislamiento entre organizaciones a la base existente: eso requiere inventariar y migrar el esquema real, incluidos `crear_pago`, las restricciones y los datos históricos. Antes de admitir otra filà, introduce organizaciones y pertenencias, añade `fila_id` a cada entidad y aplica el aislamiento en todas las consultas, políticas y RPC. No reutilices el mismo proyecto Supabase para varias filàs hasta completar ese trabajo.

El código frontend usa `select('*')` en algunas fichas administrativas. Para un despliegue real, reduce los campos personales expuestos a los necesarios, revisa el tiempo de conservación y configura copias de seguridad del proyecto Supabase.
