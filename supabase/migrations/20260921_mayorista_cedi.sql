-- =====================================================================
-- OZOAGRO — Precio mayorista + flujo CEDI (venta de OZOAGRO al distribuidor)
-- 2026-09-21 · reemplaza a 20260921_precio_mayorista.sql (nunca aplicada: cobraba al cliente
-- final el precio mayorista). Aquí el cliente final paga el precio de la landing; el costo del
-- distribuidor es el precio mayorista; y la venta de OZOAGRO al distribuidor se registra aparte
-- (canal "mayorista", con su propio margen: precio mayorista − costo de OZOAGRO).
--
-- Flujo de un pedido de distribuidor (misma fila en pedidos, columna estado_cedi):
--   distribuidor confirma  → estado='confirmado', estado_cedi='por_pagar'   (lo ve el CEO en Por confirmar › Distribuidores)
--   CEO confirma el pago   → estado_cedi='pagado'                            (Confirmados › Distribuidores)
--   CEO despacha al dist.  → estado_cedi='despachado' + guía; kardex: salida CEO / entrada distribuidor
--   distribuidor despacha  → estado='despachado' (solo si estado_cedi='despachado'; el trigger lo exige)
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1) productos.precio_mayorista (NULL = precio de venta) + precio efectivo
-- ---------------------------------------------------------------------
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_mayorista numeric(12,2);
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_precio_mayorista_check;
ALTER TABLE public.productos ADD CONSTRAINT productos_precio_mayorista_check CHECK (precio_mayorista IS NULL OR precio_mayorista >= 0);
COMMENT ON COLUMN public.productos.precio_mayorista IS 'Precio al que OZOAGRO vende al distribuidor (= costo del distribuidor). NULL = usa precio_venta.';

CREATE OR REPLACE FUNCTION public.precio_mayorista_efectivo(p_producto_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(precio_mayorista, precio_venta) FROM public.productos WHERE id = p_producto_id;
$$;
REVOKE ALL ON FUNCTION public.precio_mayorista_efectivo(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.precio_mayorista_efectivo(uuid) TO authenticated, service_role;

-- El costo de OZOAGRO no sale por la API a los distribuidores: el panel lee productos por RPC (productos_panel).
-- El cerrojo de columnas (quitar SELECT de costo_unitario/precio_mayorista a anon/authenticated) va en
-- 20260921b_productos_costo_oculto.sql y se aplica DESPUÉS del Rebuild del panel: el panel viejo hace select * y se rompería.

CREATE OR REPLACE FUNCTION public.productos_panel()
RETURNS TABLE(id uuid, nombre text, litros integer, precio_venta numeric, costo_unitario numeric, precio_mayorista numeric, activo boolean, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nombre, p.litros, p.precio_venta,
         CASE WHEN public.es_ceo() THEN p.costo_unitario ELSE COALESCE(p.precio_mayorista, p.precio_venta) END,   -- el distribuidor ve SU costo (mayorista)
         CASE WHEN public.es_ceo() THEN p.precio_mayorista ELSE NULL END,
         p.activo, p.created_at, p.updated_at
  FROM public.productos p
  WHERE public.es_ceo() OR public.mi_distribuidor_id() IS NOT NULL
  ORDER BY p.litros;
$$;
REVOKE ALL ON FUNCTION public.productos_panel() FROM public;
GRANT EXECUTE ON FUNCTION public.productos_panel() TO authenticated;

-- ---------------------------------------------------------------------
-- 2) pedidos: estado del CEDI para pedidos de distribuidor
-- ---------------------------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS estado_cedi text,
  ADD COLUMN IF NOT EXISTS fecha_cedi_pagado timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_cedi_despachado timestamptz,
  ADD COLUMN IF NOT EXISTS guia_cedi text,
  ADD COLUMN IF NOT EXISTS transportadora_cedi text,
  ADD COLUMN IF NOT EXISTS cedi_valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS cedi_costo numeric(12,2);
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_cedi_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_cedi_check CHECK (estado_cedi IS NULL OR estado_cedi IN ('por_pagar','pagado','despachado'));
CREATE INDEX IF NOT EXISTS pedidos_estado_cedi_idx ON public.pedidos (estado_cedi) WHERE estado_cedi IS NOT NULL;
COMMENT ON COLUMN public.pedidos.estado_cedi IS 'Solo pedidos de distribuidor: por_pagar (distribuidor confirmó, OZOAGRO espera el pago) → pagado → despachado (OZOAGRO envió la mercancía al distribuidor).';
COMMENT ON COLUMN public.pedidos.cedi_valor IS 'Venta de OZOAGRO al distribuidor (precio mayorista × cantidad), fijada al despachar desde el CEDI.';
COMMENT ON COLUMN public.pedidos.cedi_costo IS 'Costo de OZOAGRO de esa mercancía (costo_unitario × cantidad), fijado al despachar desde el CEDI.';

-- 2a) el costo del distribuidor en cada ítem es SIEMPRE el precio mayorista (venga del panel, la landing o el agente)
CREATE OR REPLACE FUNCTION public.pedido_items_costo_distribuidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = NEW.pedido_id AND p.distribuidor_id IS NOT NULL) THEN
    NEW.costo_unitario_snapshot := public.precio_mayorista_efectivo(NEW.producto_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pedido_items_costo_distribuidor ON public.pedido_items;
CREATE TRIGGER trg_pedido_items_costo_distribuidor BEFORE INSERT OR UPDATE OF producto_id ON public.pedido_items
  FOR EACH ROW EXECUTE FUNCTION public.pedido_items_costo_distribuidor();

-- 2b) flujo: al confirmar nace 'por_pagar'; despachar exige que el CEDI ya despachó; cancelar antes del despacho limpia el CEDI
CREATE OR REPLACE FUNCTION public.pedidos_cedi_flujo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.distribuidor_id IS NULL OR NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF NEW.estado = 'confirmado' AND NEW.estado_cedi IS NULL THEN
    NEW.estado_cedi := 'por_pagar';
  ELSIF NEW.estado = 'despachado' AND NEW.estado_cedi IS DISTINCT FROM 'despachado' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'OZOAGRO aún no ha despachado la mercancía de este pedido. Cuando confirmen tu pago y la envíen, podrás despacharlo.' USING ERRCODE = 'P0001';
  ELSIF NEW.estado = 'cancelado' AND NEW.estado_cedi IN ('por_pagar','pagado') THEN
    NEW.estado_cedi := NULL;   -- no llegó a despacharse desde el CEDI: nada que reversar en inventario
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pedidos_cedi_flujo ON public.pedidos;
CREATE TRIGGER trg_pedidos_cedi_flujo BEFORE UPDATE OF estado ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_cedi_flujo();

-- 2c) acciones del CEO
CREATE OR REPLACE FUNCTION public.cedi_confirmar_pago(p_pedido_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pedidos;
BEGIN
  IF NOT public.es_ceo() THEN RAISE EXCEPTION 'solo el CEO' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR p.distribuidor_id IS NULL THEN RAISE EXCEPTION 'no es un pedido de distribuidor'; END IF;
  IF p.estado_cedi IS DISTINCT FROM 'por_pagar' THEN RAISE EXCEPTION 'el pedido no está pendiente de pago (estado CEDI: %)', COALESCE(p.estado_cedi, 'sin confirmar por el distribuidor'); END IF;
  UPDATE public.pedidos SET estado_cedi = 'pagado', fecha_cedi_pagado = now(), updated_at = now() WHERE id = p_pedido_id;
  RETURN json_build_object('ok', true, 'estado_cedi', 'pagado');
END $$;

CREATE OR REPLACE FUNCTION public.cedi_despachar(p_pedido_id uuid, p_guia text, p_transportadora text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pedidos; d public.distribuidores; v_litros int; v_valor numeric; v_costo numeric;
BEGIN
  IF NOT public.es_ceo() THEN RAISE EXCEPTION 'solo el CEO' USING ERRCODE = '42501'; END IF;
  IF NULLIF(btrim(COALESCE(p_guia, '')), '') IS NULL THEN RAISE EXCEPTION 'la guía es obligatoria para despachar'; END IF;
  SELECT * INTO p FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF p.id IS NULL OR p.distribuidor_id IS NULL THEN RAISE EXCEPTION 'no es un pedido de distribuidor'; END IF;
  IF p.estado_cedi IS DISTINCT FROM 'pagado' THEN RAISE EXCEPTION 'primero confirma el pago del distribuidor (estado CEDI: %)', COALESCE(p.estado_cedi, 'sin confirmar'); END IF;
  SELECT * INTO d FROM public.distribuidores WHERE id = p.distribuidor_id;
  SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0),
         COALESCE(SUM(pi.cantidad * public.precio_mayorista_efectivo(pi.producto_id)), 0),
         COALESCE(SUM(pi.cantidad * pr.costo_unitario), 0)
    INTO v_litros, v_valor, v_costo
  FROM public.pedido_items pi JOIN public.productos pr ON pr.id = pi.producto_id WHERE pi.pedido_id = p_pedido_id;
  IF v_litros <= 0 THEN RAISE EXCEPTION 'el pedido no tiene productos'; END IF;
  -- kardex: sale del CEDI de OZOAGRO y entra al inventario del distribuidor a su costo (precio mayorista)
  INSERT INTO public.inventario (fecha, tipo, unidades, costo_unitario, nota, distribuidor_id)
  VALUES (now(), 'salida', v_litros, 0, 'Despacho a distribuidor ' || COALESCE(d.nombre, d.slug) || ' · pedido ' || p.codigo_publico || ' · guía ' || btrim(p_guia), NULL);
  INSERT INTO public.inventario (fecha, tipo, unidades, costo_unitario, nota, distribuidor_id)
  VALUES (now(), 'entrada', v_litros, round(v_valor / v_litros, 2), 'Recibido de OZOAGRO · pedido ' || p.codigo_publico || ' · guía ' || btrim(p_guia), p.distribuidor_id);
  UPDATE public.pedidos SET estado_cedi = 'despachado', fecha_cedi_despachado = now(), guia_cedi = btrim(p_guia), transportadora_cedi = NULLIF(btrim(COALESCE(p_transportadora, '')), ''),
         cedi_valor = v_valor, cedi_costo = v_costo, updated_at = now()
  WHERE id = p_pedido_id;
  RETURN json_build_object('ok', true, 'estado_cedi', 'despachado', 'litros', v_litros, 'valor', v_valor, 'costo', v_costo);
END $$;
REVOKE ALL ON FUNCTION public.cedi_confirmar_pago(uuid), public.cedi_despachar(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cedi_confirmar_pago(uuid), public.cedi_despachar(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3) Ventas y balance del CEO: canal 'mayorista' = lo que OZOAGRO vende a sus distribuidores
--    (reconocido al despachar desde el CEDI; margen = precio mayorista − costo OZOAGRO).
--    "Todos los canales" del CEO incluye detal + mayorista. El tenant distribuidor no cambia.
--    De paso: la venta se agrega por pedido (antes SUM(p.subtotal) se multiplicaba por el número de ítems).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ventas_resumen(p_fecha_ini date DEFAULT NULL, p_fecha_fin date DEFAULT NULL, p_ciudad text DEFAULT NULL, p_tipo_cliente text DEFAULT NULL, p_canal text DEFAULT NULL, p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(litros_vendidos bigint, venta_total numeric, costo_total numeric, rentabilidad numeric, rentabilidad_pct numeric, valor_promedio_litro numeric, num_pedidos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id);
BEGIN
  RETURN QUERY
  WITH ped AS (
    SELECT p.id, p.subtotal AS venta, p.costo_total AS costo, p.rentabilidad AS rent,
           (SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) FROM public.pedido_items pi WHERE pi.pedido_id = p.id) AS litros,
           COALESCE(p.fecha_despachado, p.created_at)::date AS f
    FROM public.pedidos p LEFT JOIN public.clientes c ON c.id = p.cliente_id
    WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false AND p.distribuidor_id IS NOT DISTINCT FROM v_t
      AND (p_ciudad IS NULL OR p.ciudad_envio ILIKE '%' || p_ciudad || '%')
      AND (p_tipo_cliente IS NULL OR c.tipo = p_tipo_cliente)
      AND (p_canal IS NULL OR p.canal = p_canal)
    UNION ALL
    SELECT p.id, p.cedi_valor, p.cedi_costo, p.cedi_valor - p.cedi_costo,
           (SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) FROM public.pedido_items pi WHERE pi.pedido_id = p.id),
           p.fecha_cedi_despachado::date
    FROM public.pedidos p
    WHERE v_t IS NULL AND p.distribuidor_id IS NOT NULL AND p.estado_cedi = 'despachado' AND p.es_test = false
      AND (p_canal IS NULL OR p_canal = 'mayorista') AND p_ciudad IS NULL AND p_tipo_cliente IS NULL
  )
  SELECT COALESCE(SUM(litros), 0)::bigint, COALESCE(SUM(venta), 0), COALESCE(SUM(costo), 0), COALESCE(SUM(rent), 0),
    CASE WHEN SUM(venta) > 0 THEN ROUND(SUM(rent) / SUM(venta) * 100, 2) ELSE 0 END,
    CASE WHEN SUM(litros) > 0 THEN ROUND(SUM(venta) / SUM(litros), 0) ELSE 0 END,
    COUNT(*)::bigint
  FROM ped
  WHERE (p_fecha_ini IS NULL OR f >= p_fecha_ini) AND (p_fecha_fin IS NULL OR f <= p_fecha_fin);
END $$;

CREATE OR REPLACE FUNCTION public.balance_resumen(p_fecha_ini date DEFAULT NULL, p_fecha_fin date DEFAULT NULL, p_canal text DEFAULT NULL, p_distribuidor_id uuid DEFAULT NULL)
RETURNS TABLE(litros_vendidos bigint, venta_total numeric, rentabilidad numeric, gastos_total numeric, utilidad numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id); v_litros bigint; v_venta numeric; v_rent numeric; v_gastos numeric;
BEGIN
  SELECT COALESCE(SUM(x.litros), 0), COALESCE(SUM(x.venta), 0), COALESCE(SUM(x.rent), 0) INTO v_litros, v_venta, v_rent
  FROM (
    SELECT p.subtotal AS venta, p.rentabilidad AS rent,
           (SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) FROM public.pedido_items pi WHERE pi.pedido_id = p.id) AS litros,
           COALESCE(p.fecha_despachado, p.created_at)::date AS f
    FROM public.pedidos p
    WHERE p.estado IN ('despachado','cerrado') AND p.es_test = false AND p.distribuidor_id IS NOT DISTINCT FROM v_t
      AND (p_canal IS NULL OR p.canal = p_canal)
    UNION ALL
    SELECT p.cedi_valor, p.cedi_valor - p.cedi_costo,
           (SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) FROM public.pedido_items pi WHERE pi.pedido_id = p.id),
           p.fecha_cedi_despachado::date
    FROM public.pedidos p
    WHERE v_t IS NULL AND p.distribuidor_id IS NOT NULL AND p.estado_cedi = 'despachado' AND p.es_test = false
      AND (p_canal IS NULL OR p_canal = 'mayorista')
  ) x
  WHERE (p_fecha_ini IS NULL OR x.f >= p_fecha_ini) AND (p_fecha_fin IS NULL OR x.f <= p_fecha_fin);
  SELECT COALESCE(SUM(valor), 0) INTO v_gastos FROM public.gastos
  WHERE distribuidor_id IS NOT DISTINCT FROM v_t AND (p_fecha_ini IS NULL OR fecha >= p_fecha_ini) AND (p_fecha_fin IS NULL OR fecha <= p_fecha_fin);
  RETURN QUERY SELECT v_litros, v_venta, v_rent, v_gastos, (v_venta - v_gastos);
END $$;

-- Detalle de ventas mayoristas para la tabla del CEO (Ventas › canal Mayorista)
CREATE OR REPLACE FUNCTION public.ventas_mayorista_detalle(p_fecha_ini date DEFAULT NULL, p_fecha_fin date DEFAULT NULL)
RETURNS TABLE(id uuid, codigo_publico text, fecha timestamptz, distribuidor text, litros bigint, valor numeric, costo numeric, rentabilidad numeric, guia text, transportadora text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.codigo_publico, p.fecha_cedi_despachado, COALESCE(d.nombre, d.slug),
         (SELECT COALESCE(SUM(pi.litros * pi.cantidad), 0) FROM public.pedido_items pi WHERE pi.pedido_id = p.id),
         p.cedi_valor, p.cedi_costo, p.cedi_valor - p.cedi_costo, p.guia_cedi, p.transportadora_cedi
  FROM public.pedidos p JOIN public.distribuidores d ON d.id = p.distribuidor_id
  WHERE public.es_ceo() AND p.estado_cedi = 'despachado' AND p.es_test = false
    AND (p_fecha_ini IS NULL OR p.fecha_cedi_despachado::date >= p_fecha_ini) AND (p_fecha_fin IS NULL OR p.fecha_cedi_despachado::date <= p_fecha_fin)
  ORDER BY p.fecha_cedi_despachado DESC;
$$;
REVOKE ALL ON FUNCTION public.ventas_mayorista_detalle(date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.ventas_mayorista_detalle(date, date) TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Datos existentes
-- ---------------------------------------------------------------------
-- costo de los ítems de distribuidor = precio mayorista (hoy = precio de venta hasta que el CEO fije el mayorista); el trigger recalcula totales
UPDATE public.pedido_items pi SET costo_unitario_snapshot = public.precio_mayorista_efectivo(pi.producto_id)
FROM public.pedidos p WHERE p.id = pi.pedido_id AND p.distribuidor_id IS NOT NULL AND p.estado IN ('por_confirmar','confirmado');
-- pedidos que el distribuidor ya confirmó y el CEO no veía → quedan por pagar (aparecen en Por confirmar › Distribuidores)
UPDATE public.pedidos SET estado_cedi = 'por_pagar' WHERE distribuidor_id IS NOT NULL AND estado = 'confirmado' AND estado_cedi IS NULL;
-- pedidos de distribuidor despachados antes de este flujo: quedan como despachados por el CEDI con lo que el distribuidor pagó (su costo registrado)
UPDATE public.pedidos p SET estado_cedi = 'despachado', fecha_cedi_despachado = COALESCE(p.fecha_despachado, p.created_at),
  cedi_valor = x.valor, cedi_costo = x.costo
FROM (SELECT pi.pedido_id, SUM(pi.cantidad * pi.costo_unitario_snapshot) AS valor, SUM(pi.cantidad * pr.costo_unitario) AS costo
      FROM public.pedido_items pi JOIN public.productos pr ON pr.id = pi.producto_id GROUP BY pi.pedido_id) x
WHERE x.pedido_id = p.id AND p.distribuidor_id IS NOT NULL AND p.estado IN ('despachado','cerrado') AND p.estado_cedi IS NULL;

COMMIT;
