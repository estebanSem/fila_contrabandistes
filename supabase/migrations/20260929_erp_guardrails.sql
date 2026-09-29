-- Review against the live schema in a staging Supabase project before applying.
-- Existing data is preserved. This migration assumes the table/column names used by the frontend.
BEGIN;

ALTER TABLE public.fester ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.acto ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.cuota ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS fester_activo_nombre_idx ON public.fester (nombre) WHERE activo;
CREATE INDEX IF NOT EXISTS pagos_cuotas_estado_idx ON public.pagos_cuotas (estado, creacion_ticket DESC);

CREATE TABLE IF NOT EXISTS public.auditoria_pagos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago bigint NOT NULL,
  accion text NOT NULL,
  actor uuid NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.auditoria_pagos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_pagos FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.es_admin_actual() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.fester WHERE auth_id = (SELECT auth.uid()) AND es_admin = true AND activo = true)
$$;
REVOKE ALL ON FUNCTION public.es_admin_actual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin_actual() TO authenticated;

CREATE OR REPLACE FUNCTION public.puede_gestionar_festero(p_id bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fester f JOIN public.fester responsable ON responsable.auth_id = (SELECT auth.uid())
    WHERE f.id_fester = p_id AND f.activo AND responsable.activo
      AND (f.id_fester = responsable.id_fester OR f.id_fester_responsable = responsable.id_fester)
  ) OR public.es_admin_actual()
$$;
REVOKE ALL ON FUNCTION public.puede_gestionar_festero(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_gestionar_festero(bigint) TO authenticated;

-- Table access is always constrained by RLS, including requests made outside the UI.
ALTER TABLE public.fester ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pago ENABLE ROW LEVEL SECURITY;

-- Remove existing policies first: permissive policies would otherwise combine with these.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('fester','acto','cuota','pagos_cuotas','detalle_pago') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY fester_read ON public.fester FOR SELECT TO authenticated
  USING (public.puede_gestionar_festero(id_fester));
CREATE POLICY fester_admin_insert ON public.fester FOR INSERT TO authenticated
  WITH CHECK (public.es_admin_actual() OR (
    id_fester_responsable IN (SELECT id_fester FROM public.fester WHERE auth_id = (SELECT auth.uid()) AND activo)
    AND auth_id IS NULL AND es_admin = false
  ));
CREATE POLICY fester_admin_update ON public.fester FOR UPDATE TO authenticated
  USING (public.es_admin_actual() OR (
    id_fester_responsable IN (SELECT id_fester FROM public.fester WHERE auth_id = (SELECT auth.uid()) AND activo)
    AND auth_id IS NULL AND es_admin = false
  ))
  WITH CHECK (public.es_admin_actual() OR (
    id_fester_responsable IN (SELECT id_fester FROM public.fester WHERE auth_id = (SELECT auth.uid()) AND activo)
    AND auth_id IS NULL AND es_admin = false AND activo
  ));
CREATE POLICY acto_read ON public.acto FOR SELECT TO authenticated USING (activo OR public.es_admin_actual());
CREATE POLICY acto_admin_insert ON public.acto FOR INSERT TO authenticated WITH CHECK (public.es_admin_actual());
CREATE POLICY acto_admin_update ON public.acto FOR UPDATE TO authenticated USING (public.es_admin_actual()) WITH CHECK (public.es_admin_actual());
CREATE POLICY cuota_read ON public.cuota FOR SELECT TO authenticated USING (activo OR public.es_admin_actual());
CREATE POLICY cuota_admin_insert ON public.cuota FOR INSERT TO authenticated WITH CHECK (public.es_admin_actual());
CREATE POLICY cuota_admin_update ON public.cuota FOR UPDATE TO authenticated USING (public.es_admin_actual()) WITH CHECK (public.es_admin_actual());
CREATE POLICY pagos_read ON public.pagos_cuotas FOR SELECT TO authenticated
  USING (public.puede_gestionar_festero(id_fester));
CREATE POLICY detalle_read ON public.detalle_pago FOR SELECT TO authenticated
  USING (public.puede_gestionar_festero(id_fester));
-- No direct browser INSERT/UPDATE/DELETE on monetary tables and no DELETE on historic tables.
REVOKE INSERT, UPDATE, DELETE ON public.pagos_cuotas, public.detalle_pago FROM anon, authenticated;
REVOKE DELETE ON public.fester, public.acto, public.cuota FROM anon, authenticated;

-- A SECURITY DEFINER legacy RPC can bypass RLS. Block obsolete entry points.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('registrar_festero', 'conciliar_pagos_cuotas') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', p.signature);
  END LOOP;
END $$;

-- Registration is completed only by the signed-in owner of a verified email.
-- Admin-created records can be claimed when both the verified email and DNI match.
CREATE OR REPLACE FUNCTION public.completar_registro(
  p_dni text, p_nombre text, p_primer_apellido text, p_segundo_apellido text,
  p_fecha_nac date, p_sexo text, p_telefono text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; v_id bigint;
BEGIN
  SELECT email INTO v_email FROM auth.users
  WHERE id = (SELECT auth.uid()) AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Confirma tu correo antes de completar la ficha'; END IF;
  IF nullif(trim(p_dni), '') IS NULL OR nullif(trim(p_nombre), '') IS NULL OR
     nullif(trim(p_primer_apellido), '') IS NULL OR nullif(trim(p_segundo_apellido), '') IS NULL OR
     p_fecha_nac IS NULL OR p_fecha_nac > current_date OR (p_sexo IS NULL OR p_sexo NOT IN ('HOMBRE','MUJER','OTRO'))
    THEN RAISE EXCEPTION 'Datos de registro inválidos'; END IF;
  IF EXISTS (SELECT 1 FROM public.fester WHERE auth_id = (SELECT auth.uid())) THEN RETURN; END IF;
  SELECT id_fester INTO v_id FROM public.fester
    WHERE lower(email) = lower(v_email) AND dni = trim(p_dni) AND auth_id IS NULL
    FOR UPDATE;
  IF v_id IS NOT NULL THEN
    UPDATE public.fester SET auth_id = (SELECT auth.uid()), activo = true WHERE id_fester = v_id;
  ELSE
    INSERT INTO public.fester(auth_id, dni, nombre, primer_apellido, segundo_apellido,
      fecha_nac, sexo, email, telefono, es_socio, es_admin, activo)
    VALUES ((SELECT auth.uid()), trim(p_dni), trim(p_nombre), trim(p_primer_apellido),
      trim(p_segundo_apellido), p_fecha_nac, p_sexo, v_email, nullif(trim(p_telefono), ''), false, false, true);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.completar_registro(text,text,text,text,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completar_registro(text,text,text,text,date,text,text) TO authenticated;

-- Return only eligible, active tariffs for the caller or a child. Current pending
-- orders are excluded to prevent generating duplicate bank transfers.
CREATE OR REPLACE FUNCTION public.cuotas_disponibles(p_id_fester bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_resultado jsonb;
BEGIN
  IF NOT public.puede_gestionar_festero(p_id_fester) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('out_id_cuota', c.id_cuota,
    'nombre_acto', a.nombre, 'precio', c.precio) ORDER BY a.nombre), '[]'::jsonb)
    INTO v_resultado
  FROM public.cuota c JOIN public.acto a ON a.id_acto = c.id_acto
  JOIN public.fester f ON f.id_fester = p_id_fester
  WHERE c.activo AND a.activo AND f.activo AND c.eres_socio = f.es_socio
    AND c.sexo_cuota IN ('AMBOS', f.sexo)
    AND date_part('year', age(current_date, f.fecha_nac)) BETWEEN c.edad_min AND c.edad_max
    AND NOT EXISTS (
      SELECT 1 FROM public.detalle_pago d JOIN public.pagos_cuotas p ON p.id_pago = d.id_pago
      WHERE d.id_fester = f.id_fester AND d.id_cuota = c.id_cuota AND p.estado IN ('PENDIENTE','PAGADO')
    );
  RETURN v_resultado;
END $$;
REVOKE ALL ON FUNCTION public.cuotas_disponibles(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cuotas_disponibles(bigint) TO authenticated;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'mostrar_cuotas' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', p.signature);
  END LOOP;
END $$;

-- Prevent self-service users from making children members or administrators.
CREATE OR REPLACE FUNCTION public.validar_edicion_festero() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_admin_actual() THEN
    IF TG_OP = 'INSERT' AND (NEW.es_socio OR NEW.es_admin OR
      (NEW.auth_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users
        WHERE id = NEW.auth_id AND id = (SELECT auth.uid()) AND email_confirmed_at IS NOT NULL
          AND lower(email) = lower(NEW.email)))) THEN
      RAISE EXCEPTION 'La tesorería debe asignar la condición de socio' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND
      (NEW.es_socio IS DISTINCT FROM OLD.es_socio OR NEW.es_admin IS DISTINCT FROM OLD.es_admin OR
       (NEW.auth_id IS DISTINCT FROM OLD.auth_id AND NOT (OLD.auth_id IS NULL AND
         NEW.auth_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM auth.users
           WHERE id = NEW.auth_id AND email_confirmed_at IS NOT NULL AND lower(email) = lower(NEW.email)))) OR
       NEW.id_fester_responsable IS DISTINCT FROM OLD.id_fester_responsable) THEN
      RAISE EXCEPTION 'Cambio reservado a administración' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_edicion_festero ON public.fester;
CREATE TRIGGER validar_edicion_festero BEFORE INSERT OR UPDATE ON public.fester
FOR EACH ROW EXECUTE FUNCTION public.validar_edicion_festero();

-- Payment creation still uses the existing crear_pago RPC. Guards execute even when
-- that RPC is SECURITY DEFINER; they bind its inserts to the authenticated payer.
CREATE OR REPLACE FUNCTION public.validar_nuevo_pago() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.fester WHERE id_fester = NEW.id_fester AND auth_id = (SELECT auth.uid()) AND activo
  ) THEN RAISE EXCEPTION 'Responsable no autorizado' USING ERRCODE = '42501'; END IF;
  IF NEW.estado <> 'PENDIENTE' THEN RAISE EXCEPTION 'Estado inicial inválido'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_nuevo_pago ON public.pagos_cuotas;
CREATE TRIGGER validar_nuevo_pago BEFORE INSERT ON public.pagos_cuotas
FOR EACH ROW EXECUTE FUNCTION public.validar_nuevo_pago();

CREATE OR REPLACE FUNCTION public.validar_detalle_pago() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_responsable bigint;
BEGIN
  -- Serialize orders for the same festero to reject duplicate concurrent tickets.
  PERFORM 1 FROM public.fester WHERE id_fester = NEW.id_fester FOR UPDATE;
  SELECT id_fester INTO v_responsable FROM public.pagos_cuotas WHERE id_pago = NEW.id_pago;
  IF v_responsable IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.fester WHERE id_fester = NEW.id_fester AND activo
      AND (id_fester = v_responsable OR id_fester_responsable = v_responsable)
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cuota c JOIN public.acto a ON a.id_acto = c.id_acto
      JOIN public.fester f ON f.id_fester = NEW.id_fester
    WHERE c.id_cuota = NEW.id_cuota AND c.activo AND a.activo
      AND c.eres_socio = f.es_socio AND c.sexo_cuota IN ('AMBOS', f.sexo)
      AND date_part('year', age(current_date, f.fecha_nac)) BETWEEN c.edad_min AND c.edad_max
      AND c.precio = NEW.importe_total
      AND NOT EXISTS (SELECT 1 FROM public.detalle_pago d
        JOIN public.pagos_cuotas p ON p.id_pago = d.id_pago
        WHERE d.id_fester = NEW.id_fester AND d.id_cuota = NEW.id_cuota
          AND p.estado IN ('PENDIENTE','PAGADO'))
  ) THEN RAISE EXCEPTION 'Detalle no autorizado' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_detalle_pago ON public.detalle_pago;
CREATE TRIGGER validar_detalle_pago BEFORE INSERT ON public.detalle_pago
FOR EACH ROW EXECUTE FUNCTION public.validar_detalle_pago();

-- Verify the complete ticket after the legacy RPC has inserted all lines.
CREATE OR REPLACE FUNCTION public.validar_total_pago() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_total numeric; v_lineas integer;
BEGIN
  SELECT sum(importe_total), count(*) INTO v_total, v_lineas
  FROM public.detalle_pago WHERE id_pago = NEW.id_pago;
  IF v_lineas = 0 OR v_total IS DISTINCT FROM NEW.importe_total THEN
    RAISE EXCEPTION 'El total del pago no coincide con sus líneas'; END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS validar_total_pago ON public.pagos_cuotas;
CREATE CONSTRAINT TRIGGER validar_total_pago AFTER INSERT ON public.pagos_cuotas
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validar_total_pago();

CREATE OR REPLACE FUNCTION public.confirmar_pago_cuota(p_id_pago bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_admin_actual() THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  UPDATE public.pagos_cuotas SET estado = 'PAGADO', fecha_pago = now()
  WHERE id_pago = p_id_pago AND estado = 'PENDIENTE';
  IF NOT FOUND THEN RAISE EXCEPTION 'El pago no está pendiente'; END IF;
  INSERT INTO public.auditoria_pagos(id_pago, accion, actor) VALUES (p_id_pago, 'CONFIRMACION_MANUAL', (SELECT auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.archivar_festero(p_id_fester bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.puede_gestionar_festero(p_id_fester) OR
     (NOT public.es_admin_actual() AND EXISTS (SELECT 1 FROM public.fester WHERE id_fester = p_id_fester AND auth_id IS NOT NULL))
  THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  UPDATE public.fester SET activo = false WHERE id_fester = p_id_fester AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festero no encontrado'; END IF;
  UPDATE public.fester SET activo = false WHERE id_fester_responsable = p_id_fester AND activo;
END $$;
CREATE OR REPLACE FUNCTION public.archivar_acto(p_id_acto bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_admin_actual() THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  UPDATE public.cuota SET activo = false WHERE id_acto = p_id_acto;
  UPDATE public.acto SET activo = false WHERE id_acto = p_id_acto;
END $$;
CREATE OR REPLACE FUNCTION public.archivar_cuota(p_id_cuota bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.es_admin_actual() THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  UPDATE public.cuota SET activo = false WHERE id_cuota = p_id_cuota;
END $$;

-- Preview and apply use identical matching rules. Amounts must match exactly.
CREATE OR REPLACE FUNCTION public.previsualizar_conciliacion(p_movimientos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m jsonb; salida jsonb := '[]'::jsonb; v_estado text; v_importe numeric; v_concepto text;
BEGIN
  IF NOT public.es_admin_actual() THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_movimientos) <> 'array' OR jsonb_array_length(p_movimientos) NOT BETWEEN 1 AND 100
    THEN RAISE EXCEPTION 'Lote inválido'; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(p_movimientos) LOOP
    v_concepto := trim(m->>'concepto');
    IF v_concepto IS NULL OR v_concepto = '' OR (m->>'importe') !~ '^\d+(\.\d{1,2})?$'
      THEN RAISE EXCEPTION 'Movimiento inválido'; END IF;
    v_importe := (m->>'importe')::numeric;
    SELECT CASE WHEN count(*) = 0 THEN 'NO_ENCONTRADO'
                WHEN count(*) > 1 THEN 'AMBIGUO'
                WHEN max(importe_total) <> v_importe THEN 'IMPORTE_DISTINTO'
                WHEN max(estado) <> 'PENDIENTE' THEN 'YA_PROCESADO'
                ELSE 'COINCIDE' END INTO v_estado
    FROM public.pagos_cuotas WHERE concepto = v_concepto;
    salida := salida || jsonb_build_array(jsonb_build_object('concepto', v_concepto, 'importe', v_importe, 'estado', v_estado));
  END LOOP;
  RETURN salida;
END $$;

CREATE OR REPLACE FUNCTION public.conciliar_pagos_cuotas_seguro(p_movimientos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m jsonb; r jsonb; v_id bigint; v_actualizados integer := 0; vistos text[] := '{}';
BEGIN
  -- Re-evaluate under row lock below; preview is advisory, not authorization.
  PERFORM public.previsualizar_conciliacion(p_movimientos);
  FOR m IN SELECT value FROM jsonb_array_elements(p_movimientos) LOOP
    IF (m->>'concepto') = ANY(vistos) THEN RAISE EXCEPTION 'Concepto duplicado'; END IF;
    vistos := array_append(vistos, m->>'concepto');
    SELECT id_pago INTO v_id FROM public.pagos_cuotas
      WHERE concepto = m->>'concepto' AND importe_total = (m->>'importe')::numeric
        AND estado = 'PENDIENTE'
        AND (SELECT count(*) FROM public.pagos_cuotas WHERE concepto = m->>'concepto') = 1
      FOR UPDATE;
    IF v_id IS NOT NULL THEN
      UPDATE public.pagos_cuotas SET estado = 'PAGADO', fecha_pago = now() WHERE id_pago = v_id AND estado = 'PENDIENTE';
      IF FOUND THEN
        INSERT INTO public.auditoria_pagos(id_pago, accion, actor, datos)
          VALUES (v_id, 'CONCILIACION', (SELECT auth.uid()), m);
        v_actualizados := v_actualizados + 1;
      END IF;
    END IF;
    v_id := NULL;
  END LOOP;
  RETURN jsonb_build_object('actualizados', v_actualizados);
END $$;

-- No direct UPDATE of audit logs or payment history from a signed-in client.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('confirmar_pago_cuota','archivar_festero','archivar_acto','archivar_cuota',
                              'previsualizar_conciliacion','conciliar_pagos_cuotas_seguro') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', p.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', p.signature);
  END LOOP;
END $$;
COMMIT;
