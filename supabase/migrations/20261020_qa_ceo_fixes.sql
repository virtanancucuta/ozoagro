-- 2026-10-20 · Arreglos previos al test del CEO (auditoría 360°)
-- 1) n8n_chat_histories (memoria del agente) estaba abierta a anon/authenticated sin RLS → se cierra.
--    n8n entra como n8n_memory, dueño de la tabla, así que RLS no lo afecta.
-- 2) slugs_reservados: un usuario autenticado (distribuidor) podía insertar/borrar → solo lectura.
-- 3) balance_resumen: utilidad = rentabilidad − gastos (antes venta − gastos, sin costo de mercancía).
-- 4) Fechas en hora de Colombia en ventas/balance/mayorista/visitas (antes ::date en UTC).
-- 5) crear_pedido_panel: pedido tradicional + items en una sola transacción, con validaciones
--    (antes el panel insertaba pedido e items por separado: pedidos en $0 y correo antes de los items).
-- 6) crear_pedido_web: celular colombiano válido (10 dígitos que empiezan por 3, o 57 + 10).

-- 1) Memoria del agente
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.n8n_chat_histories FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.n8n_chat_histories_id_seq FROM anon, authenticated;

-- 2) Slugs reservados: solo lectura para el panel
ALTER TABLE public.slugs_reservados ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.slugs_reservados FROM authenticated;
CREATE POLICY slugs_reservados_lectura ON public.slugs_reservados FOR SELECT TO authenticated USING (true);
-- validar_distribuidor_nuevo corre como el que inserta: necesita leer la lista aun con RLS
ALTER FUNCTION public.validar_distribuidor_nuevo() SECURITY DEFINER;
ALTER FUNCTION public.validar_distribuidor_nuevo() SET search_path TO 'public';

-- 3) + 4) Balance
CREATE OR REPLACE FUNCTION public.balance_resumen(p_fecha_ini date DEFAULT NULL::date, p_fecha_fin date DEFAULT NULL::date, p_canal text DEFAULT NULL::text, p_distribuidor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(litros_vendidos bigint, venta_total numeric, rentabilidad numeric, gastos_total numeric, utilidad numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET timezone TO 'America/Bogota'
AS $function$
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
  RETURN QUERY SELECT v_litros, v_venta, v_rent, v_gastos, (v_rent - v_gastos);   -- utilidad = rentabilidad (venta − costo) − gastos
END $function$;

-- 4) Hora de Colombia en el resto de resúmenes por fecha
ALTER FUNCTION public.ventas_resumen(date, date, text, text, text, uuid) SET timezone TO 'America/Bogota';
ALTER FUNCTION public.ventas_mayorista_detalle(date, date) SET timezone TO 'America/Bogota';
ALTER FUNCTION public.crm_visitas(uuid) SET timezone TO 'America/Bogota';

-- 5) Pedido tradicional desde el panel, atómico
CREATE OR REPLACE FUNCTION public.crear_pedido_panel(
  p_items jsonb,
  p_cliente_id uuid DEFAULT NULL,
  p_cliente jsonb DEFAULT NULL,
  p_ciudad text DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_distribuidor_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ceo boolean := public.es_ceo(); v_mi uuid := public.mi_distribuidor_id(); v_dist uuid;
  v_cliente uuid; v_pedido uuid; v_codigo text; v_total numeric; it jsonb; v_prod record;
  v_cant int; v_precio numeric; v_tel text; v_nombre text; v_tipo text;
BEGIN
  IF NOT v_ceo AND v_mi IS NULL THEN RETURN json_build_object('error', 'Tu usuario no puede crear pedidos'); END IF;
  v_dist := CASE WHEN v_ceo THEN p_distribuidor_id ELSE v_mi END;   -- el distribuidor siempre crea en su tenant
  IF v_dist IS NOT NULL AND NOT EXISTS (SELECT 1 FROM distribuidores WHERE id = v_dist) THEN
    RETURN json_build_object('error', 'Distribuidor no encontrado');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN json_build_object('error', 'Agrega al menos un producto');
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS (SELECT 1 FROM productos WHERE id = (it->>'producto_id')::uuid) THEN
      RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    IF COALESCE((it->>'cantidad')::int, 0) < 1 THEN RETURN json_build_object('error', 'La cantidad debe ser 1 o más'); END IF;
    IF COALESCE((it->>'precio_unitario')::numeric, 0) <= 0 THEN RETURN json_build_object('error', 'El precio debe ser mayor a 0'); END IF;
  END LOOP;

  IF p_cliente_id IS NOT NULL THEN
    SELECT id INTO v_cliente FROM clientes
     WHERE id = p_cliente_id AND (v_ceo OR distribuidor_id = v_mi);
    IF v_cliente IS NULL THEN RETURN json_build_object('error', 'Cliente no encontrado'); END IF;
  ELSE
    v_nombre := btrim(COALESCE(p_cliente->>'nombre', ''));
    IF length(v_nombre) < 2 THEN RETURN json_build_object('error', 'Selecciona o crea un cliente (nombre obligatorio)'); END IF;
    v_tel := regexp_replace(COALESCE(p_cliente->>'telefono', ''), '\D', '', 'g');
    IF v_tel ~ '^3[0-9]{9}$' THEN v_tel := '57' || v_tel; END IF;
    IF v_tel !~ '^573[0-9]{9}$' THEN RETURN json_build_object('error', 'Celular inválido: 10 dígitos que empiecen por 3'); END IF;
    v_tipo := CASE WHEN p_cliente->>'tipo' = 'distribuidor' THEN 'distribuidor' ELSE 'generico' END;
    INSERT INTO clientes (nombre, cedula, telefono, email, ciudad, tipo, origen, distribuidor_id)
    VALUES (v_nombre, NULLIF(btrim(COALESCE(p_cliente->>'cedula', '')), ''), v_tel,
            NULLIF(lower(btrim(COALESCE(p_cliente->>'email', ''))), ''), NULLIF(btrim(COALESCE(p_cliente->>'ciudad', '')), ''),
            v_tipo, 'tradicional', v_dist)
    RETURNING id INTO v_cliente;
  END IF;

  INSERT INTO pedidos (cliente_id, canal, estado, ciudad_envio, direccion_envio, distribuidor_id)
  VALUES (v_cliente, 'tradicional', 'por_confirmar', NULLIF(btrim(COALESCE(p_ciudad, '')), ''), NULLIF(btrim(COALESCE(p_direccion, '')), ''), v_dist)
  RETURNING id, codigo_publico INTO v_pedido, v_codigo;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_prod FROM productos WHERE id = (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::int; v_precio := (it->>'precio_unitario')::numeric;
    -- costo real de OZOAGRO; si el pedido es de distribuidor, el trigger lo cambia por el precio mayorista
    INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario_snapshot, litros)
    VALUES (v_pedido, v_prod.id, v_cant, v_precio, COALESCE(v_prod.costo_unitario, 0), v_prod.litros);
  END LOOP;

  SELECT subtotal INTO v_total FROM pedidos WHERE id = v_pedido;
  RETURN json_build_object('success', true, 'codigo', v_codigo, 'pedido_id', v_pedido, 'total', v_total);
END $function$;
REVOKE ALL ON FUNCTION public.crear_pedido_panel(jsonb, uuid, jsonb, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_panel(jsonb, uuid, jsonb, text, text, uuid) TO authenticated;

-- 6) Celular válido en pedidos de la landing
CREATE OR REPLACE FUNCTION public.crear_pedido_web(p_nombre text, p_telefono text, p_producto_id uuid, p_cantidad integer DEFAULT 1, p_email text DEFAULT NULL::text, p_direccion text DEFAULT NULL::text, p_ciudad text DEFAULT NULL::text, p_departamento text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_fbclid text DEFAULT NULL::text, p_cultivo text DEFAULT NULL::text, p_distribuidor_slug text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id uuid; v_pedido_id uuid; v_codigo text; v_producto record; v_dist uuid;
  v_cant int := GREATEST(COALESCE(p_cantidad,1),1); v_litros_tot int; v_total numeric;
BEGIN
  SELECT * INTO v_producto FROM productos WHERE id = p_producto_id AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Producto no encontrado'); END IF;
  IF COALESCE(NULLIF(trim(p_telefono),''), '') = '' OR COALESCE(NULLIF(trim(p_nombre),''), '') = '' THEN
    RETURN json_build_object('error', 'Nombre y teléfono son obligatorios');
  END IF;
  IF regexp_replace(p_telefono, '\D', '', 'g') !~ '^(57)?3[0-9]{9}$' THEN
    RETURN json_build_object('error', 'Revisa tu celular: debe tener 10 dígitos y empezar por 3');
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
END $function$;
