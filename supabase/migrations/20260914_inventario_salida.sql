-- 2026-09-14 · Inventario del CEO: tipo SALIDA con observaciones obligatorias + edición de movimientos.
-- Pedido de Jorge: "tengo ajuste y entrada pero no salida, y observaciones de por qué la salida; poder editarse".
-- Aditivo: entrada/ajuste siguen igual. Una salida resta stock; su costo_unitario NO entra en el costo promedio.

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_tipo_check;
ALTER TABLE public.inventario ADD CONSTRAINT inventario_tipo_check CHECK (tipo IN ('entrada', 'ajuste', 'salida'));
ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_salida_nota_check;
ALTER TABLE public.inventario ADD CONSTRAINT inventario_salida_nota_check CHECK (tipo <> 'salida' OR (nota IS NOT NULL AND btrim(nota) <> ''));
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Definición VIVA leída el 2026-09-14 (pg_get_functiondef) + salidas restando y fuera del costo promedio.
CREATE OR REPLACE FUNCTION public.cobertura_stock(p_distribuidor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(unidades_disponibles bigint, costo_inventario numeric, venta_diaria_proyectada numeric, cobertura_dias numeric, mensaje text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_t uuid := public.tenant_efectivo(p_distribuidor_id); v_entradas bigint; v_costo_unit numeric; v_salidas bigint; v_unidades bigint; v_litros_30 bigint; v_venta_diaria numeric;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN tipo = 'salida' THEN -unidades ELSE unidades END), 0),
         COALESCE(SUM(unidades * costo_unitario) FILTER (WHERE tipo <> 'salida') / NULLIF(SUM(unidades) FILTER (WHERE tipo <> 'salida'), 0),
                  (SELECT costo_unitario FROM productos WHERE litros=1 AND activo LIMIT 1), 36000)
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
END $function$;
