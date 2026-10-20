-- 2026-10-20 (c) · Ajustes de crear_pedido_panel tras /code-review:
-- solo productos activos; el cliente debe ser del mismo tenant que el pedido; un cliente existente vuelve a
-- estado_crm 'por_contactar'; un 'cliente nuevo' con un celular ya registrado en la cuenta se reutiliza.
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
    IF NOT EXISTS (SELECT 1 FROM productos WHERE id = (it->>'producto_id')::uuid AND activo) THEN
      RETURN json_build_object('error', 'Producto no encontrado');
    END IF;
    IF COALESCE((it->>'cantidad')::int, 0) < 1 THEN RETURN json_build_object('error', 'La cantidad debe ser 1 o más'); END IF;
    IF COALESCE((it->>'precio_unitario')::numeric, 0) <= 0 THEN RETURN json_build_object('error', 'El precio debe ser mayor a 0'); END IF;
  END LOOP;

  IF p_cliente_id IS NOT NULL THEN
    -- el cliente debe ser del mismo dueño del pedido (OZOAGRO o ese distribuidor): no se mezclan tenants
    SELECT id INTO v_cliente FROM clientes
     WHERE id = p_cliente_id AND distribuidor_id IS NOT DISTINCT FROM v_dist;
    IF v_cliente IS NULL THEN
      RETURN json_build_object('error', CASE WHEN EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id)
        THEN 'Ese cliente pertenece a otra cuenta: créalo como cliente nuevo para este distribuidor' ELSE 'Cliente no encontrado' END);
    END IF;
    UPDATE clientes SET estado_crm = 'por_contactar', updated_at = now() WHERE id = v_cliente;   -- vuelve a "Por contactar" en el CRM
  ELSE
    v_nombre := btrim(COALESCE(p_cliente->>'nombre', ''));
    IF length(v_nombre) < 2 THEN RETURN json_build_object('error', 'Selecciona o crea un cliente (nombre obligatorio)'); END IF;
    v_tel := regexp_replace(COALESCE(p_cliente->>'telefono', ''), '\D', '', 'g');
    IF v_tel ~ '^3[0-9]{9}$' THEN v_tel := '57' || v_tel; END IF;
    IF v_tel !~ '^573[0-9]{9}$' THEN RETURN json_build_object('error', 'Celular inválido: 10 dígitos que empiecen por 3'); END IF;
    v_tipo := CASE WHEN p_cliente->>'tipo' = 'distribuidor' THEN 'distribuidor' ELSE 'generico' END;
    -- si ya existe un cliente con ese celular en la misma cuenta, se reutiliza (no se duplica)
    SELECT id INTO v_cliente FROM clientes
     WHERE distribuidor_id IS NOT DISTINCT FROM v_dist AND regexp_replace(telefono, '\D', '', 'g') IN (v_tel, substr(v_tel, 3))
     ORDER BY created_at LIMIT 1;
    IF v_cliente IS NOT NULL THEN
      UPDATE clientes SET estado_crm = 'por_contactar', updated_at = now() WHERE id = v_cliente;
    ELSE
    INSERT INTO clientes (nombre, cedula, telefono, email, ciudad, tipo, origen, distribuidor_id)
    VALUES (v_nombre, NULLIF(btrim(COALESCE(p_cliente->>'cedula', '')), ''), v_tel,
            NULLIF(lower(btrim(COALESCE(p_cliente->>'email', ''))), ''), NULLIF(btrim(COALESCE(p_cliente->>'ciudad', '')), ''),
            v_tipo, 'tradicional', v_dist)
    RETURNING id INTO v_cliente;
    END IF;
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
