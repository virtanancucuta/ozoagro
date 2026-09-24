-- =====================================================================
-- OZOAGRO — precio_total_litros v3: combinación MÁS BARATA (antes greedy: mayor presentación primero)
-- 2026-09-24 · OK de Jorge. Bug: 12 L cobraba 10 unidades + 2 × 1 L = $1.359.800, el agente cotiza 3 galones = $1.229.700
-- (también 13, 22, 23 L). Ahora:
--   1) si hay presentación activa con ese litraje exacto → su precio (igual que antes: 10 L = "10 unidades" de la landing);
--   2) si no → mínima suma combinando presentaciones activas (misma lógica que el nodo "Armar precios" del agente);
--   3) sin presentación de 1 L activa, los litros sueltos valen config_negocio.precio_litro_extra (igual que antes).
-- Definición anterior (viva) leída con pg_get_functiondef antes del REPLACE; firma, SECURITY DEFINER y search_path iguales.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.precio_total_litros(p_litros integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n int := COALESCE(p_litros, 0);
  v_precio numeric; v_extra numeric;
  v_l int[]; v_p numeric[];
  v_best numeric[]; v_cand numeric;
  i int; k int;
BEGIN
  IF v_n <= 0 THEN RETURN 0; END IF;
  SELECT precio_venta INTO v_precio FROM productos WHERE litros = v_n AND activo ORDER BY updated_at DESC LIMIT 1;
  IF v_precio IS NOT NULL THEN RETURN v_precio; END IF;

  -- presentaciones activas (un precio por litraje: el más reciente)
  SELECT array_agg(litros ORDER BY litros), array_agg(precio_venta ORDER BY litros) INTO v_l, v_p
  FROM (SELECT DISTINCT ON (litros) litros, precio_venta FROM productos
        WHERE activo AND litros > 0 AND precio_venta > 0 ORDER BY litros, updated_at DESC) s;
  IF v_l IS NULL OR NOT (1 = ANY (v_l)) THEN
    SELECT precio_litro_extra INTO v_extra FROM config_negocio LIMIT 1;
    v_l := array_prepend(1, COALESCE(v_l, '{}'::int[]));
    v_p := array_prepend(COALESCE(v_extra, 100000), COALESCE(v_p, '{}'::numeric[]));
  END IF;

  -- mínima suma: v_best[i+1] = costo mínimo de i litros
  v_best := array_fill(NULL::numeric, ARRAY[v_n + 1]);
  v_best[1] := 0;
  FOR i IN 1..v_n LOOP
    FOR k IN 1..array_length(v_l, 1) LOOP
      IF v_l[k] <= i AND v_best[i - v_l[k] + 1] IS NOT NULL THEN
        v_cand := v_best[i - v_l[k] + 1] + v_p[k];
        IF v_best[i + 1] IS NULL OR v_cand < v_best[i + 1] THEN v_best[i + 1] := v_cand; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_best[v_n + 1];
END $function$;
