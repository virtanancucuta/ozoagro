BEGIN;
UPDATE resenas SET aprobada=false WHERE origen='semilla' AND nombre IN ('Andrés López','Carlos Ramírez');
UPDATE resenas SET foto_url=NULL WHERE origen='semilla' AND nombre IN ('Luis Fernando','Diego Pérez','Wilson Rodríguez');
UPDATE resenas SET foto_url='images/p1.webp' WHERE origen='semilla' AND nombre='Jorge Martínez';
-- precio por combinación de presentaciones: 20 / 10 / galón 4 / 1 (greedy), igual que comprar en la landing
CREATE OR REPLACE FUNCTION public.precio_total_litros(p_litros integer)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_rest int := COALESCE(p_litros,0); v_total numeric := 0; r record; v_precio numeric; v_extra numeric;
BEGIN
  IF v_rest <= 0 THEN RETURN 0; END IF;
  SELECT precio_venta INTO v_precio FROM productos WHERE litros = v_rest AND activo ORDER BY updated_at DESC LIMIT 1;
  IF v_precio IS NOT NULL THEN RETURN v_precio; END IF;
  FOR r IN SELECT litros, precio_venta FROM productos WHERE activo AND litros > 0 ORDER BY litros DESC LOOP
    IF v_rest >= r.litros THEN
      v_total := v_total + (v_rest / r.litros) * r.precio_venta;
      v_rest := v_rest % r.litros;
    END IF;
  END LOOP;
  IF v_rest > 0 THEN
    SELECT precio_litro_extra INTO v_extra FROM config_negocio LIMIT 1;
    v_total := v_total + v_rest * COALESCE(v_extra, 100000);
  END IF;
  RETURN v_total;
END $function$;
COMMIT;
