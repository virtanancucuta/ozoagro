-- =====================================================================
-- OZOAGRO — Precio Mayorista para Distribuidores
-- 2026-09-21
-- El precio_mayorista es el costo que paga el distribuidor a OZOAGRO.
-- Cuando un distribuidor vende, su costo = precio_mayorista del producto.
-- =====================================================================
BEGIN;

-- 1. Agregar columna precio_mayorista a productos
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS precio_mayorista NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.productos.precio_mayorista IS 'Precio al que OZOAGRO vende al distribuidor (costo del distribuidor). NULL = usa precio_venta.';

-- 2. Función helper: obtener precio mayorista efectivo
CREATE OR REPLACE FUNCTION public.precio_mayorista_efectivo(p_producto_id uuid)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(precio_mayorista, precio_venta) FROM public.productos WHERE id = p_producto_id;
$$;

-- 3. Actualizar crear_pedido_web para usar precio mayorista cuando es distribuidor
-- El distribuidor paga precio_mayorista, y ese es su costo
DROP FUNCTION IF EXISTS public.crear_pedido_web(text,text,uuid,integer,text,text,text,text,text,text,text,text);
CREATE FUNCTION public.crear_pedido_web(
  p_nombre text, p_telefono text, p_producto_id uuid, p_cantidad integer DEFAULT 1,
  p_email text DEFAULT NULL, p_direccion text DEFAULT NULL, p_ciudad text DEFAULT NULL,
  p_departamento text DEFAULT NULL, p_utm_source text DEFAULT NULL, p_fbclid text DEFAULT NULL,
  p_cultivo text DEFAULT NULL, p_distribuidor_slug text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id uuid; v_pedido_id uuid; v_codigo text; v_producto record; v_dist uuid;
  v_cant int := GREATEST(COALESCE(p_cantidad,1),1); v_litros_tot int; v_total numeric;
  v_precio_unit numeric; v_costo_unit numeric;
BEGIN
  SELECT * INTO v_producto FROM productos WHERE id = p_producto_id AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Producto no encontrado'); END IF;
  IF COALESCE(NULLIF(trim(p_telefono),''), '') = '' OR COALESCE(NULLIF(trim(p_nombre),''), '') = '' THEN
    RETURN json_build_object('error', 'Nombre y teléfono son obligatorios');
  END IF;

  IF NULLIF(trim(COALESCE(p_distribuidor_slug,'')),'') IS NOT NULL THEN
    v_dist := public.distribuidor_id_por_slug(p_distribuidor_slug);
  END IF;

  v_litros_tot := v_producto.litros * v_cant;

  -- Si es pedido de distribuidor: precio = precio_mayorista (o precio_venta si no tiene)
  -- El costo del distribuidor = precio_mayorista
  IF v_dist IS NOT NULL THEN
    v_precio_unit := COALESCE(v_producto.precio_mayorista, v_producto.precio_venta);
    v_costo_unit := v_precio_unit; -- El distribuidor paga este precio a OZOAGRO
    v_total := v_precio_unit * v_cant;
  ELSE
    v_total := precio_total_litros(v_litros_tot);
    v_precio_unit := round(v_total / v_cant, 2);
    v_costo_unit := v_producto.costo_unitario;
  END IF;

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
  VALUES (v_pedido_id, p_producto_id, v_cant, v_precio_unit, v_costo_unit, v_producto.litros);

  RETURN json_build_object('success', true, 'codigo', v_codigo, 'pedido_id', v_pedido_id, 'total', v_total, 'litros', v_litros_tot, 'distribuidor', v_dist IS NOT NULL);
END $$;

REVOKE ALL ON FUNCTION public.crear_pedido_web(text,text,uuid,integer,text,text,text,text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.crear_pedido_web(text,text,uuid,integer,text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;

COMMIT;
