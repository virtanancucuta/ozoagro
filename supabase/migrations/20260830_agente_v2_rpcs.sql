-- Migración para Agente Andres v2
-- Agrega columnas de lead a wa_conversaciones y crea RPCs para el agente

-- 1. Agregar columnas de lead a wa_conversaciones (si no existen)
ALTER TABLE wa_conversaciones
ADD COLUMN IF NOT EXISTS ciudad TEXT,
ADD COLUMN IF NOT EXISTS departamento TEXT,
ADD COLUMN IF NOT EXISTS cultivo TEXT;

-- 2. RPC actualizar_lead: actualiza datos del lead desde el agente
CREATE OR REPLACE FUNCTION actualizar_lead(
  p_telefono TEXT,
  p_nombre TEXT DEFAULT NULL,
  p_ciudad TEXT DEFAULT NULL,
  p_departamento TEXT DEFAULT NULL,
  p_cultivo TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  -- Buscar conversación por teléfono
  SELECT id INTO v_conv_id FROM wa_conversaciones WHERE telefono = p_telefono;

  IF v_conv_id IS NULL THEN
    RETURN 'no_conversation';
  END IF;

  -- Actualizar solo los campos no nulos
  UPDATE wa_conversaciones SET
    nombre = COALESCE(p_nombre, nombre),
    ciudad = COALESCE(p_ciudad, ciudad),
    departamento = COALESCE(p_departamento, departamento),
    cultivo = COALESCE(p_cultivo, cultivo),
    updated_at = NOW()
  WHERE id = v_conv_id;

  RETURN 'ok';
END;
$$;

-- 3. RPC crear_pedido_agente: crea pedido desde el agente WhatsApp
CREATE OR REPLACE FUNCTION crear_pedido_agente(
  p_telefono TEXT,
  p_pedido JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_pedido_id UUID;
  v_producto_id UUID;
  v_codigo TEXT;
  v_precio NUMERIC;
  v_costo NUMERIC;
  v_litros INT;
  v_cantidad INT;
  v_subtotal NUMERIC;
  v_costo_total NUMERIC;
  v_nombre TEXT;
  v_ciudad TEXT;
  v_departamento TEXT;
  v_direccion TEXT;
  v_combo_litros INT;
  v_pedido_existente UUID;
BEGIN
  -- Extraer datos del pedido
  v_nombre := p_pedido->>'nombre';
  v_ciudad := p_pedido->>'ciudad';
  v_departamento := p_pedido->>'departamento';
  v_direccion := p_pedido->>'direccion';
  v_combo_litros := COALESCE((p_pedido->>'combo_litros')::INT, 2);
  v_cantidad := COALESCE((p_pedido->>'cantidad')::INT, 1);

  -- Idempotencia: verificar si ya existe un pedido por_confirmar en los últimos 10 minutos
  SELECT p.id INTO v_pedido_existente
  FROM pedidos p
  JOIN clientes c ON p.cliente_id = c.id
  WHERE c.telefono = p_telefono
    AND p.estado = 'por_confirmar'
    AND p.canal = 'agente'
    AND p.created_at > NOW() - INTERVAL '10 minutes'
  LIMIT 1;

  IF v_pedido_existente IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'duplicate', 'pedido_id', v_pedido_existente);
  END IF;

  -- Buscar o crear cliente
  SELECT id INTO v_cliente_id FROM clientes WHERE telefono = p_telefono;

  IF v_cliente_id IS NULL THEN
    INSERT INTO clientes (nombre, telefono, ciudad, departamento, direccion, origen, estado_crm)
    VALUES (v_nombre, p_telefono, v_ciudad, v_departamento, v_direccion, 'agente', 'por_contactar')
    RETURNING id INTO v_cliente_id;
  ELSE
    -- Actualizar datos del cliente existente
    UPDATE clientes SET
      nombre = COALESCE(v_nombre, nombre),
      ciudad = COALESCE(v_ciudad, ciudad),
      departamento = COALESCE(v_departamento, departamento),
      direccion = COALESCE(v_direccion, direccion),
      estado_crm = 'por_contactar',
      updated_at = NOW()
    WHERE id = v_cliente_id;
  END IF;

  -- Buscar producto por litros
  SELECT id, precio_venta, costo_unitario, litros
  INTO v_producto_id, v_precio, v_costo, v_litros
  FROM productos
  WHERE litros = v_combo_litros AND activo = true
  LIMIT 1;

  IF v_producto_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Producto no encontrado para ' || v_combo_litros || ' litros');
  END IF;

  -- Calcular totales
  v_subtotal := v_precio * v_cantidad;
  v_costo_total := v_costo * v_cantidad;

  -- Generar código público
  SELECT 'OZO-' || LPAD((COALESCE(MAX(SUBSTRING(codigo_publico FROM 5)::INT), 0) + 1)::TEXT, 5, '0')
  INTO v_codigo FROM pedidos;

  -- Crear pedido
  INSERT INTO pedidos (
    codigo_publico, cliente_id, canal, estado, subtotal, costo_total,
    rentabilidad, rentabilidad_negativa, ciudad_envio, direccion_envio, notas
  ) VALUES (
    v_codigo, v_cliente_id, 'agente', 'por_confirmar', v_subtotal, v_costo_total,
    v_subtotal - v_costo_total, FALSE, v_ciudad, v_direccion,
    'Pedido cerrado por agente WhatsApp. Combo: ' || v_combo_litros || 'L x' || v_cantidad
  ) RETURNING id INTO v_pedido_id;

  -- Crear item del pedido
  INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
  VALUES (v_pedido_id, v_producto_id, v_cantidad, v_precio, v_costo, v_subtotal);

  RETURN jsonb_build_object(
    'status', 'ok',
    'pedido_id', v_pedido_id,
    'codigo', v_codigo,
    'cliente_id', v_cliente_id,
    'total', v_subtotal
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION actualizar_lead TO service_role;
GRANT EXECUTE ON FUNCTION crear_pedido_agente TO service_role;
