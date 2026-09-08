-- =====================================================================
-- OZOAGRO — DISTRIBUIDORES (multi-tenant) — FASE 1: BD + aislamiento
-- 2026-09-08. Aplicada con OK explícito de Jorge ("comienza").
-- Regla: distribuidor_id NULL = OZOAGRO central (CEO). Datos existentes no se tocan.
-- =====================================================================
BEGIN;

-- 1. ADMINS (CEO) y DISTRIBUIDORES ---------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.admins (auth_user_id, nombre)
SELECT id, 'CEO OZOAGRO' FROM auth.users WHERE email = 'ceo@ozoagro.co'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.distribuidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$'),
  nombre text NOT NULL,
  cedula text,
  ciudad text,
  departamento text,
  telefono text,
  whatsapp text,
  email text,
  usuario text UNIQUE,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  activo boolean NOT NULL DEFAULT true,
  es_test boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.slugs_reservados (slug text PRIMARY KEY);
INSERT INTO public.slugs_reservados VALUES ('panel'),('images'),('videos'),('js'),('css'),('api'),('admin'),('ozoagro'),('login'),('index'),('landing'),('manifest'),('robots'),('sitemap')
ON CONFLICT DO NOTHING;

-- 2. COLUMNA distribuidor_id en tablas con datos por distribuidor ---------
ALTER TABLE public.pedidos               ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
ALTER TABLE public.clientes              ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
ALTER TABLE public.gastos                ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
ALTER TABLE public.inventario            ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
ALTER TABLE public.visitas               ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
ALTER TABLE public.checkouts_abandonados ADD COLUMN IF NOT EXISTS distribuidor_id uuid REFERENCES public.distribuidores(id);
CREATE INDEX IF NOT EXISTS pedidos_distribuidor_idx    ON public.pedidos (distribuidor_id);
CREATE INDEX IF NOT EXISTS clientes_distribuidor_idx   ON public.clientes (distribuidor_id);
CREATE INDEX IF NOT EXISTS gastos_distribuidor_idx     ON public.gastos (distribuidor_id);
CREATE INDEX IF NOT EXISTS inventario_distribuidor_idx ON public.inventario (distribuidor_id);
CREATE INDEX IF NOT EXISTS visitas_distribuidor_idx    ON public.visitas (distribuidor_id);
CREATE INDEX IF NOT EXISTS checkouts_distribuidor_idx  ON public.checkouts_abandonados (distribuidor_id);
-- cédula única POR distribuidor (antes era global): un mismo cliente puede existir en el CEO y en un distribuidor
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_cedula_key;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cedula_tenant_key
  ON public.clientes (cedula, COALESCE(distribuidor_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE cedula IS NOT NULL;

-- 3. FUNCIONES DE CONTEXTO ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_ceo() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.mi_distribuidor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.distribuidores WHERE auth_user_id = auth.uid() AND activo LIMIT 1;
$$;
-- tenant efectivo para las RPC: CEO decide (NULL = lo propio); distribuidor siempre el suyo; otros: sin permiso
CREATE OR REPLACE FUNCTION public.tenant_efectivo(p_distribuidor_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF public.es_ceo() THEN RETURN p_distribuidor_id; END IF;
  v := public.mi_distribuidor_id();
  IF v IS NULL THEN RAISE EXCEPTION 'sin permiso' USING ERRCODE = '42501'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.es_ceo(), public.mi_distribuidor_id(), public.tenant_efectivo(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.es_ceo(), public.mi_distribuidor_id(), public.tenant_efectivo(uuid) TO authenticated, anon, service_role;

-- 4. TRIGGER: asignar tenant al insertar (distribuidor → su id; CEO/anon → queda como venga) ----
CREATE OR REPLACE FUNCTION public.asignar_distribuidor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  v := public.mi_distribuidor_id();
  IF v IS NOT NULL THEN
    NEW.distribuidor_id := v;              -- un distribuidor SIEMPRE escribe en su tenant
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos','clientes','gastos','inventario','visitas','checkouts_abandonados'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_tenant_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_tenant_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.asignar_distribuidor()', t, t);
  END LOOP;
END $$;
-- el distribuidor no puede cambiar de tenant una fila (ni el CEO por error desde el panel)
CREATE OR REPLACE FUNCTION public.proteger_tenant() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.distribuidor_id IS DISTINCT FROM OLD.distribuidor_id AND NOT public.es_ceo() THEN
    RAISE EXCEPTION 'no puede cambiar el distribuidor de este registro' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos','clientes','gastos','inventario'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_tenant_upd_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_tenant_upd_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.proteger_tenant()', t, t);
  END LOOP;
END $$;

-- 5. RLS -----------------------------------------------------------------
-- 5a. tablas por tenant
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos','clientes','gastos','inventario','visitas','checkouts_abandonados'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (public.es_ceo() OR (public.mi_distribuidor_id() IS NOT NULL AND distribuidor_id = public.mi_distribuidor_id()))
      WITH CHECK (public.es_ceo() OR (public.mi_distribuidor_id() IS NOT NULL AND distribuidor_id = public.mi_distribuidor_id()))$p$, t || '_tenant', t);
  END LOOP;
END $$;
-- nombres reales de las políticas viejas (por si difieren del patrón)
DROP POLICY IF EXISTS checkouts_auth_all ON public.checkouts_abandonados;
-- 5b. pedido_items: hereda del pedido
DROP POLICY IF EXISTS pedido_items_auth_all ON public.pedido_items;
DROP POLICY IF EXISTS pedido_items_tenant ON public.pedido_items;
CREATE POLICY pedido_items_tenant ON public.pedido_items FOR ALL TO authenticated
  USING (public.es_ceo() OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_items.pedido_id AND public.mi_distribuidor_id() IS NOT NULL AND p.distribuidor_id = public.mi_distribuidor_id()))
  WITH CHECK (public.es_ceo() OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_items.pedido_id AND public.mi_distribuidor_id() IS NOT NULL AND p.distribuidor_id = public.mi_distribuidor_id()));
-- 5c. productos: todos leen, solo CEO escribe
DROP POLICY IF EXISTS productos_auth_all ON public.productos;
DROP POLICY IF EXISTS productos_auth_read ON public.productos;
DROP POLICY IF EXISTS productos_ceo_ins ON public.productos;
DROP POLICY IF EXISTS productos_ceo_upd ON public.productos;
DROP POLICY IF EXISTS productos_ceo_del ON public.productos;
CREATE POLICY productos_auth_read ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY productos_ceo_ins ON public.productos FOR INSERT TO authenticated WITH CHECK (public.es_ceo());
CREATE POLICY productos_ceo_upd ON public.productos FOR UPDATE TO authenticated USING (public.es_ceo()) WITH CHECK (public.es_ceo());
CREATE POLICY productos_ceo_del ON public.productos FOR DELETE TO authenticated USING (public.es_ceo());
-- 5d. config_negocio: todos leen (WhatsApp, textos), solo CEO escribe
DROP POLICY IF EXISTS config_auth_all ON public.config_negocio;
DROP POLICY IF EXISTS config_auth_read ON public.config_negocio;
DROP POLICY IF EXISTS config_ceo_write ON public.config_negocio;
CREATE POLICY config_auth_read ON public.config_negocio FOR SELECT TO authenticated USING (true);
CREATE POLICY config_ceo_write ON public.config_negocio FOR ALL TO authenticated USING (public.es_ceo()) WITH CHECK (public.es_ceo());
-- 5e. solo CEO
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('wa_conversaciones','wa_conv_auth_all'),('wa_mensajes','wa_msg_auth_all'),('agente_acciones_ceo','agente_acciones_auth_all'),
      ('correos_enviados','correos_auth_read'),('resenas','resenas_auth_all'),('productos_costo_historial','productos_historial_auth_all')) v(t,pol) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.t || '_solo_ceo', r.t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.es_ceo()) WITH CHECK (public.es_ceo())', r.t || '_solo_ceo', r.t);
  END LOOP;
END $$;
-- 5f. admins y distribuidores
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admins_solo_ceo ON public.admins;
CREATE POLICY admins_solo_ceo ON public.admins FOR ALL TO authenticated USING (public.es_ceo()) WITH CHECK (public.es_ceo());
ALTER TABLE public.distribuidores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS distribuidores_ceo_all ON public.distribuidores;
DROP POLICY IF EXISTS distribuidores_propio_sel ON public.distribuidores;
DROP POLICY IF EXISTS distribuidores_propio_upd ON public.distribuidores;
CREATE POLICY distribuidores_ceo_all ON public.distribuidores FOR ALL TO authenticated USING (public.es_ceo()) WITH CHECK (public.es_ceo());
CREATE POLICY distribuidores_propio_sel ON public.distribuidores FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY distribuidores_propio_upd ON public.distribuidores FOR UPDATE TO authenticated USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
-- el distribuidor solo puede cambiar sus datos de contacto
CREATE OR REPLACE FUNCTION public.proteger_distribuidor() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.es_ceo() THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.activo IS DISTINCT FROM OLD.activo OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.usuario IS DISTINCT FROM OLD.usuario OR NEW.es_test IS DISTINCT FROM OLD.es_test OR NEW.cedula IS DISTINCT FROM OLD.cedula OR NEW.notas IS DISTINCT FROM OLD.notas THEN
      RAISE EXCEPTION 'solo puede editar sus datos de contacto' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.slug IN (SELECT slug FROM public.slugs_reservados) THEN RAISE EXCEPTION 'slug reservado: %', NEW.slug; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_distribuidor ON public.distribuidores;
CREATE TRIGGER trg_proteger_distribuidor BEFORE UPDATE ON public.distribuidores FOR EACH ROW EXECUTE FUNCTION public.proteger_distribuidor();
CREATE OR REPLACE FUNCTION public.validar_distribuidor_nuevo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IN (SELECT slug FROM public.slugs_reservados) THEN RAISE EXCEPTION 'slug reservado: %', NEW.slug; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_distribuidor_nuevo ON public.distribuidores;
CREATE TRIGGER trg_validar_distribuidor_nuevo BEFORE INSERT ON public.distribuidores FOR EACH ROW EXECUTE FUNCTION public.validar_distribuidor_nuevo();
-- grants (RLS limita)
REVOKE ALL ON public.admins, public.distribuidores, public.slugs_reservados FROM anon, public;
GRANT SELECT ON public.admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distribuidores TO authenticated;
GRANT SELECT ON public.slugs_reservados TO authenticated;
GRANT ALL ON public.admins, public.distribuidores, public.slugs_reservados TO service_role;

-- 6. RPC CON TENANT (DROP + CREATE porque cambia la firma) --------------------
DROP FUNCTION IF EXISTS public.ventas_resumen(date, date, text, text, text);
CREATE FUNCTION public.ventas_resumen(p_fecha_ini date DEFAULT NULL, p_fecha_fin date DEFAULT NULL, p_ciudad text DEFAULT NULL, p_tipo_cliente text DEFAULT NULL, p_canal text DEFAULT NULL, p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(litros_vendidos bigint, venta_total numeric, costo_total numeric, rentabilidad numeric, rentabilidad_pct numeric, valor_promedio_litro numeric, num_pedidos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id);
BEGIN
  RETURN QUERY
  SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0)::bigint, COALESCE(SUM(p.subtotal), 0), COALESCE(SUM(p.costo_total), 0), COALESCE(SUM(p.rentabilidad), 0),
    CASE WHEN SUM(p.subtotal) > 0 THEN ROUND(SUM(p.rentabilidad) / SUM(p.subtotal) * 100, 2) ELSE 0 END,
    CASE WHEN SUM(pi.litros * pi.cantidad) > 0 THEN ROUND(SUM(p.subtotal) / SUM(pi.litros * pi.cantidad), 0) ELSE 0 END,
    COUNT(DISTINCT p.id)::bigint
  FROM pedidos p LEFT JOIN pedido_items pi ON pi.pedido_id = p.id LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false
    AND p.distribuidor_id IS NOT DISTINCT FROM v_t
    AND (p_fecha_ini IS NULL OR COALESCE(p.fecha_despachado, p.created_at)::date >= p_fecha_ini)
    AND (p_fecha_fin IS NULL OR COALESCE(p.fecha_despachado, p.created_at)::date <= p_fecha_fin)
    AND (p_ciudad IS NULL OR p.ciudad_envio ILIKE '%' || p_ciudad || '%')
    AND (p_tipo_cliente IS NULL OR c.tipo = p_tipo_cliente)
    AND (p_canal IS NULL OR p.canal = p_canal);
END $$;

DROP FUNCTION IF EXISTS public.balance_resumen(date, date, text);
CREATE FUNCTION public.balance_resumen(p_fecha_ini date DEFAULT NULL, p_fecha_fin date DEFAULT NULL, p_canal text DEFAULT NULL, p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(litros_vendidos bigint, venta_total numeric, rentabilidad numeric, gastos_total numeric, utilidad numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id); v_litros bigint; v_venta numeric; v_rent numeric; v_gastos numeric;
BEGIN
  SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0), COALESCE(SUM(p.subtotal), 0), COALESCE(SUM(p.rentabilidad), 0)
  INTO v_litros, v_venta, v_rent
  FROM pedidos p LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
  WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false AND p.distribuidor_id IS NOT DISTINCT FROM v_t
    AND (p_fecha_ini IS NULL OR COALESCE(p.fecha_despachado, p.created_at)::date >= p_fecha_ini)
    AND (p_fecha_fin IS NULL OR COALESCE(p.fecha_despachado, p.created_at)::date <= p_fecha_fin)
    AND (p_canal IS NULL OR p.canal = p_canal);
  SELECT COALESCE(SUM(valor), 0) INTO v_gastos FROM gastos
  WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND (p_fecha_ini IS NULL OR fecha >= p_fecha_ini) AND (p_fecha_fin IS NULL OR fecha <= p_fecha_fin);
  RETURN QUERY SELECT v_litros, v_venta, v_rent, v_gastos, (v_venta - v_gastos);
END $$;

DROP FUNCTION IF EXISTS public.cobertura_stock();
CREATE FUNCTION public.cobertura_stock(p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(unidades_disponibles bigint, costo_inventario numeric, venta_diaria_proyectada numeric, cobertura_dias numeric, mensaje text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id); v_entradas bigint; v_costo_unit numeric; v_salidas bigint; v_unidades bigint; v_litros_30 bigint; v_venta_diaria numeric;
BEGIN
  SELECT COALESCE(SUM(unidades), 0), COALESCE(SUM(unidades * costo_unitario) / NULLIF(SUM(unidades),0), (SELECT costo_unitario FROM productos WHERE litros=1 AND activo LIMIT 1), 36000)
  INTO v_entradas, v_costo_unit FROM inventario WHERE distribuidor_id IS NOT DISTINCT FROM v_t;
  SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) INTO v_salidas
  FROM pedidos p JOIN pedido_items pi ON pi.pedido_id = p.id
  WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false AND p.distribuidor_id IS NOT DISTINCT FROM v_t;
  v_unidades := GREATEST(v_entradas - v_salidas, 0);
  SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) INTO v_litros_30
  FROM pedidos p JOIN pedido_items pi ON pi.pedido_id = p.id
  WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false AND p.distribuidor_id IS NOT DISTINCT FROM v_t
    AND COALESCE(p.fecha_despachado, p.created_at) >= NOW() - INTERVAL '30 days';
  v_venta_diaria := v_litros_30::numeric / 30;
  IF v_venta_diaria = 0 THEN
    RETURN QUERY SELECT v_unidades, ROUND(v_unidades * v_costo_unit, 0), 0::numeric, NULL::numeric, 'Sin ventas en los últimos 30 días'::text;
  ELSE
    RETURN QUERY SELECT v_unidades, ROUND(v_unidades * v_costo_unit, 0), ROUND(v_venta_diaria, 2), ROUND(v_unidades / v_venta_diaria, 1), NULL::text;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.crm_clientes(text, text);
CREATE FUNCTION public.crm_clientes(p_tipo text DEFAULT NULL, p_orden text DEFAULT 'mayor_compra', p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, nombre text, tipo text, telefono text, ciudad text, cultivo text, ultima_compra_fecha timestamptz, ultima_compra_litros integer, ultima_compra_valor numeric, total_litros integer, total_valor numeric, dias_sin_comprar integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id);
BEGIN
  RETURN QUERY
  SELECT c.id, c.nombre, c.tipo, c.telefono, c.ciudad, c.cultivo, c.ultima_compra_fecha, c.ultima_compra_cantidad_litros, c.ultima_compra_valor, c.total_comprado_litros, c.total_comprado_valor,
    CASE WHEN c.ultima_compra_fecha IS NOT NULL THEN EXTRACT(DAY FROM NOW() - c.ultima_compra_fecha)::integer ELSE NULL END
  FROM clientes c
  WHERE c.distribuidor_id IS NOT DISTINCT FROM v_t AND (p_tipo IS NULL OR c.tipo = p_tipo)
  ORDER BY
    CASE WHEN p_orden = 'mayor_compra' THEN c.total_comprado_valor END DESC NULLS LAST,
    CASE WHEN p_orden = 'mas_dias_sin_comprar' THEN CASE WHEN c.ultima_compra_fecha IS NOT NULL THEN EXTRACT(DAY FROM NOW() - c.ultima_compra_fecha)::integer ELSE 999999 END END DESC,
    CASE WHEN p_orden = 'menos_dias_sin_comprar' THEN CASE WHEN c.ultima_compra_fecha IS NOT NULL THEN EXTRACT(DAY FROM NOW() - c.ultima_compra_fecha)::integer ELSE 999999 END END ASC;
END $$;

DROP FUNCTION IF EXISTS public.crm_visitas();
CREATE FUNCTION public.crm_visitas(p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(visitas_hoy bigint, visitas_pauta_hoy bigint, visitas_7_dias bigint, carritos_7_dias bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id);
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM visitas WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND fecha::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM visitas WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND fecha::date = CURRENT_DATE AND (utm_source IS NOT NULL OR fbclid IS NOT NULL OR ttclid IS NOT NULL)),
    (SELECT COUNT(*) FROM visitas WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND fecha >= NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*) FROM checkouts_abandonados WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND created_at >= NOW() - INTERVAL '7 days');
END $$;

-- chats IA: solo CEO (misma lógica, con guardia)
CREATE OR REPLACE FUNCTION public.chats_ia_marcar(p_conversacion_id uuid, p_contactado boolean, p_nota text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_ceo() THEN RAISE EXCEPTION 'sin permiso' USING ERRCODE = '42501'; END IF;
  UPDATE wa_conversaciones
     SET metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('contactado', p_contactado, 'contactado_at', now()) || CASE WHEN p_nota IS NOT NULL THEN jsonb_build_object('nota', p_nota) ELSE '{}'::jsonb END,
         updated_at = now()
   WHERE id = p_conversacion_id;
END $$;
-- chats_ia_resumen es SQL puro: se envuelve con guardia sin cambiar la consulta
ALTER FUNCTION public.chats_ia_resumen() RENAME TO chats_ia_resumen_interno;
REVOKE ALL ON FUNCTION public.chats_ia_resumen_interno() FROM public, anon, authenticated;
CREATE FUNCTION public.chats_ia_resumen()
RETURNS TABLE(conversacion_id uuid, telefono text, nombre text, ciudad text, departamento text, cultivo text, inicio timestamptz, ultimo_mensaje timestamptz, n_mensajes bigint, n_usuario bigint, ultimo_texto text, tiene_pedido boolean, pedido_codigo text, pedido_estado text, pedido_total numeric, pedido_fecha timestamptz, contactado boolean, nota text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_ceo() THEN RAISE EXCEPTION 'sin permiso' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.chats_ia_resumen_interno();
END $$;

-- 7. LANDING: pedido / visita / carrito con slug del distribuidor --------------
CREATE OR REPLACE FUNCTION public.distribuidor_id_por_slug(p_slug text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.distribuidores WHERE slug = lower(trim(p_slug)) AND activo LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.distribuidor_id_por_slug(text) FROM public, anon;

DROP FUNCTION IF EXISTS public.crear_pedido_web(text, text, uuid, integer, text, text, text, text, text, text, text);
CREATE FUNCTION public.crear_pedido_web(p_nombre text, p_telefono text, p_producto_id uuid, p_cantidad integer DEFAULT 1, p_email text DEFAULT NULL, p_direccion text DEFAULT NULL, p_ciudad text DEFAULT NULL, p_departamento text DEFAULT NULL, p_utm_source text DEFAULT NULL, p_fbclid text DEFAULT NULL, p_cultivo text DEFAULT NULL, p_distribuidor_slug text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id uuid; v_pedido_id uuid; v_codigo text; v_producto record; v_dist uuid;
  v_cant int := GREATEST(COALESCE(p_cantidad,1),1); v_litros_tot int; v_total numeric;
BEGIN
  SELECT * INTO v_producto FROM productos WHERE id = p_producto_id AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Producto no encontrado'); END IF;
  IF COALESCE(NULLIF(trim(p_telefono),''), '') = '' OR COALESCE(NULLIF(trim(p_nombre),''), '') = '' THEN
    RETURN json_build_object('error', 'Nombre y teléfono son obligatorios');
  END IF;
  IF NULLIF(trim(COALESCE(p_distribuidor_slug,'')),'') IS NOT NULL THEN
    v_dist := public.distribuidor_id_por_slug(p_distribuidor_slug);   -- slug inválido/inactivo → pedido al CEO
  END IF;
  v_litros_tot := v_producto.litros * v_cant;
  v_total := precio_total_litros(v_litros_tot);

  SELECT id INTO v_cliente_id FROM clientes WHERE telefono = p_telefono AND distribuidor_id IS NOT DISTINCT FROM v_dist LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO clientes (nombre, telefono, email, direccion, ciudad, departamento, cultivo, origen, distribuidor_id)
    VALUES (p_nombre, p_telefono, NULLIF(p_email,''), p_direccion, p_ciudad, p_departamento, NULLIF(p_cultivo,''), 'web', v_dist)
    RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE clientes SET nombre = COALESCE(NULLIF(p_nombre,''), nombre), email = COALESCE(NULLIF(p_email,''), email),
      direccion = COALESCE(NULLIF(p_direccion,''), direccion), ciudad = COALESCE(NULLIF(p_ciudad,''), ciudad),
      departamento = COALESCE(NULLIF(p_departamento,''), departamento), cultivo = COALESCE(NULLIF(p_cultivo,''), cultivo),
      estado_crm = 'por_contactar', updated_at = now()
    WHERE id = v_cliente_id;
  END IF;

  INSERT INTO pedidos (cliente_id, canal, estado, ciudad_envio, direccion_envio, distribuidor_id, notas)
  VALUES (v_cliente_id, 'web', 'por_confirmar', p_ciudad, p_direccion, v_dist,
          'Pedido desde la landing' || CASE WHEN v_dist IS NOT NULL THEN ' del distribuidor ' || p_distribuidor_slug ELSE '' END || '. Pago contraentrega.' ||
          CASE WHEN NULLIF(p_cultivo,'') IS NOT NULL THEN ' Cultivo: ' || p_cultivo || '.' ELSE '' END ||
          CASE WHEN p_utm_source IS NOT NULL THEN ' utm_source=' || p_utm_source ELSE '' END ||
          CASE WHEN p_fbclid IS NOT NULL THEN ' fbclid=si' ELSE '' END)
  RETURNING id, codigo_publico INTO v_pedido_id, v_codigo;

  INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario_snapshot, litros)
  VALUES (v_pedido_id, p_producto_id, v_cant, round(v_total / v_cant, 2), v_producto.costo_unitario, v_producto.litros);

  RETURN json_build_object('success', true, 'codigo', v_codigo, 'pedido_id', v_pedido_id, 'total', v_total, 'litros', v_litros_tot, 'distribuidor', v_dist IS NOT NULL);
END $$;

DROP FUNCTION IF EXISTS public.registrar_visita(text, text, text, text, text, text, text, text, text);
CREATE FUNCTION public.registrar_visita(p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_referrer text DEFAULT NULL, p_utm_source text DEFAULT NULL, p_utm_medium text DEFAULT NULL, p_utm_campaign text DEFAULT NULL, p_fbclid text DEFAULT NULL, p_ttclid text DEFAULT NULL, p_pagina text DEFAULT '/', p_distribuidor_slug text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_dist uuid;
BEGIN
  IF NULLIF(trim(COALESCE(p_distribuidor_slug,'')),'') IS NOT NULL THEN v_dist := public.distribuidor_id_por_slug(p_distribuidor_slug); END IF;
  INSERT INTO visitas (ip, user_agent, referrer, utm_source, utm_medium, utm_campaign, fbclid, ttclid, pagina, distribuidor_id)
  VALUES (p_ip, p_user_agent, p_referrer, p_utm_source, p_utm_medium, p_utm_campaign, p_fbclid, p_ttclid, p_pagina, v_dist)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

DROP FUNCTION IF EXISTS public.registrar_carrito_abandonado(text, text, uuid, integer, text, text);
CREATE FUNCTION public.registrar_carrito_abandonado(p_nombre text, p_telefono text, p_producto_id uuid, p_cantidad integer DEFAULT 1, p_email text DEFAULT NULL, p_ciudad text DEFAULT NULL, p_distribuidor_slug text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_dist uuid;
BEGIN
  IF NULLIF(trim(COALESCE(p_distribuidor_slug,'')),'') IS NOT NULL THEN v_dist := public.distribuidor_id_por_slug(p_distribuidor_slug); END IF;
  INSERT INTO checkouts_abandonados (nombre, telefono, email, ciudad, producto_id, cantidad, distribuidor_id)
  VALUES (p_nombre, p_telefono, p_email, p_ciudad, p_producto_id, p_cantidad, v_dist)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 8. NUEVAS RPC ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_perfil() RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
  IF public.es_ceo() THEN
    RETURN json_build_object('rol', 'ceo', 'nombre', (SELECT nombre FROM admins WHERE auth_user_id = auth.uid()));
  END IF;
  SELECT * INTO d FROM distribuidores WHERE auth_user_id = auth.uid();
  IF d.id IS NULL THEN RETURN json_build_object('rol', 'ninguno'); END IF;
  RETURN json_build_object('rol', 'distribuidor', 'distribuidor_id', d.id, 'nombre', d.nombre, 'slug', d.slug, 'ciudad', d.ciudad, 'departamento', d.departamento,
                           'telefono', d.telefono, 'whatsapp', d.whatsapp, 'email', d.email, 'activo', d.activo, 'landing', 'https://ozoagro.co/' || d.slug);
END $$;

CREATE OR REPLACE FUNCTION public.distribuidor_publico(p_slug text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('slug', slug, 'nombre', nombre, 'ciudad', ciudad, 'departamento', departamento, 'whatsapp', whatsapp)
  FROM public.distribuidores WHERE slug = lower(trim(p_slug)) AND activo LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.distribuidores_resumen()
RETURNS TABLE(id uuid, slug text, nombre text, cedula text, ciudad text, departamento text, telefono text, whatsapp text, email text, usuario text, activo boolean, es_test boolean, created_at timestamptz,
              pedidos_total bigint, pedidos_por_confirmar bigint, ventas_cerradas numeric, litros_vendidos bigint, clientes bigint, ultima_venta timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_ceo() THEN RAISE EXCEPTION 'sin permiso' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT d.id, d.slug, d.nombre, d.cedula, d.ciudad, d.departamento, d.telefono, d.whatsapp, d.email, d.usuario, d.activo, d.es_test, d.created_at,
    (SELECT count(*) FROM pedidos p WHERE p.distribuidor_id = d.id),
    (SELECT count(*) FROM pedidos p WHERE p.distribuidor_id = d.id AND p.estado = 'por_confirmar'),
    (SELECT COALESCE(sum(p.subtotal),0) FROM pedidos p WHERE p.distribuidor_id = d.id AND p.estado IN ('despachado','cerrado') AND NOT p.es_test),
    (SELECT COALESCE(sum(pi.litros*pi.cantidad),0)::bigint FROM pedidos p JOIN pedido_items pi ON pi.pedido_id = p.id WHERE p.distribuidor_id = d.id AND p.estado IN ('despachado','cerrado') AND NOT p.es_test),
    (SELECT count(*) FROM clientes c WHERE c.distribuidor_id = d.id),
    (SELECT max(COALESCE(p.fecha_despachado, p.created_at)) FROM pedidos p WHERE p.distribuidor_id = d.id AND p.estado IN ('despachado','cerrado'))
  FROM distribuidores d ORDER BY d.created_at;
END $$;

-- 9. GRANTS de RPC --------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ventas_resumen(date,date,text,text,text,uuid), public.balance_resumen(date,date,text,uuid), public.cobertura_stock(uuid),
  public.crm_clientes(text,text,uuid), public.crm_visitas(uuid), public.chats_ia_resumen(), public.chats_ia_marcar(uuid,boolean,text),
  public.mi_perfil(), public.distribuidores_resumen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ventas_resumen(date,date,text,text,text,uuid), public.balance_resumen(date,date,text,uuid), public.cobertura_stock(uuid),
  public.crm_clientes(text,text,uuid), public.crm_visitas(uuid), public.chats_ia_resumen(), public.chats_ia_marcar(uuid,boolean,text),
  public.mi_perfil(), public.distribuidores_resumen() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crear_pedido_web(text,text,uuid,integer,text,text,text,text,text,text,text,text),
  public.registrar_visita(text,text,text,text,text,text,text,text,text,text), public.registrar_carrito_abandonado(text,text,uuid,integer,text,text,text),
  public.distribuidor_publico(text) FROM public;
GRANT EXECUTE ON FUNCTION public.crear_pedido_web(text,text,uuid,integer,text,text,text,text,text,text,text,text),
  public.registrar_visita(text,text,text,text,text,text,text,text,text,text), public.registrar_carrito_abandonado(text,text,uuid,integer,text,text,text),
  public.distribuidor_publico(text) TO anon, authenticated, service_role;

COMMIT;
