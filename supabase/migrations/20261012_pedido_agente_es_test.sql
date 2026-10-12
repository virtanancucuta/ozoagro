-- 2026-10-12 · crear_pedido_agente guarda pedidos.es_test que manda n8n en modo prueba.
-- Motivo: las pruebas E2E del agente mandaban el correo "Nuevo pedido" real a ozoagro.ceo@gmail.com
-- (trg_pedidos_correos ya omite es_test, pero esta funcion nunca lo marcaba). Misma firma: CREATE OR REPLACE.
-- Base: definicion VIVA (pg_get_functiondef) del 2026-10-12, solo cambia el INSERT de pedidos.
CREATE OR REPLACE FUNCTION public.crear_pedido_agente(p_telefono text, p_pedido jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_combo int := GREATEST(COALESCE(NULLIF(p_pedido->>'combo_litros','')::int, 1), 1);
  v_cant  int := GREATEST(COALESCE(NULLIF(p_pedido->>'cantidad','')::int, 1), 1);
  v_litros_tot int; v_precio_total numeric; v_prod record; v_items_cant int;
  v_cliente_id uuid; v_pedido_id uuid; v_existente record; v_conv record;
BEGIN
  v_litros_tot := v_combo * v_cant;
  v_precio_total := precio_total_litros(v_litros_tot);

  SELECT p.id, p.codigo_publico INTO v_existente
  FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
  WHERE c.telefono = p_telefono AND p.canal = 'agente' AND p.estado = 'por_confirmar'
    AND p.created_at > now() - interval '10 minutes'
  LIMIT 1;
  IF v_existente.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicado', true, 'pedido_id', v_existente.id, 'codigo', v_existente.codigo_publico);
  END IF;

  SELECT * INTO v_conv FROM wa_conversaciones WHERE telefono = p_telefono;

  SELECT id INTO v_cliente_id FROM clientes WHERE telefono = p_telefono LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO clientes (tipo, nombre, telefono, direccion, ciudad, departamento, pais, cultivo, origen, estado_crm)
    VALUES ('generico',
            COALESCE(NULLIF(p_pedido->>'nombre',''), v_conv.nombre, 'Cliente WhatsApp'),
            p_telefono, NULLIF(p_pedido->>'direccion',''),
            COALESCE(NULLIF(p_pedido->>'ciudad',''), v_conv.ciudad),
            COALESCE(NULLIF(p_pedido->>'departamento',''), v_conv.departamento),
            'Colombia', COALESCE(NULLIF(p_pedido->>'cultivo',''), v_conv.cultivo), 'agente', 'por_contactar')
    RETURNING id INTO v_cliente_id;
  ELSE
    UPDATE clientes SET
      nombre       = COALESCE(NULLIF(p_pedido->>'nombre',''), nombre),
      direccion    = COALESCE(NULLIF(p_pedido->>'direccion',''), direccion),
      ciudad       = COALESCE(NULLIF(p_pedido->>'ciudad',''), v_conv.ciudad, ciudad),
      departamento = COALESCE(NULLIF(p_pedido->>'departamento',''), v_conv.departamento, departamento),
      cultivo      = COALESCE(NULLIF(p_pedido->>'cultivo',''), v_conv.cultivo, cultivo),
      estado_crm   = 'por_contactar', updated_at = now()
    WHERE id = v_cliente_id;
  END IF;

  SELECT * INTO v_prod FROM productos WHERE litros = v_combo AND activo LIMIT 1;
  IF v_prod.id IS NULL THEN
    SELECT * INTO v_prod FROM productos WHERE litros = 1 AND activo LIMIT 1;
    v_items_cant := v_litros_tot;
  ELSE
    v_items_cant := v_cant;
  END IF;
  IF v_prod.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no hay productos activos'); END IF;

  INSERT INTO pedidos (cliente_id, canal, estado, ciudad_envio, direccion_envio, notas, es_test)
  VALUES (v_cliente_id, 'agente', 'por_confirmar',
          COALESCE(NULLIF(p_pedido->>'ciudad',''), v_conv.ciudad), NULLIF(p_pedido->>'direccion',''),
          'Pedido tomado por el Ingeniero Andres (agente IA). Pago contraentrega. ' || COALESCE(NULLIF(p_pedido->>'notas',''), ''),
          -- 2026-10-12: n8n manda es_test=true en modo prueba (wamid.TEST_) -> trg_pedidos_correos no envia correo al CEO
          COALESCE((p_pedido->>'es_test')::boolean, false))
  RETURNING id INTO v_pedido_id;

  INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario_snapshot, litros)
  VALUES (v_pedido_id, v_prod.id, v_items_cant, round(v_precio_total / v_items_cant, 2), v_prod.costo_unitario, v_prod.litros);

  RETURN jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'litros', v_litros_tot, 'total', v_precio_total);
END $function$;
