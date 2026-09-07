BEGIN;
-- 1. PRECIOS = landing nueva (ZIP del programador). Costo se mantiene a $36.000/L.
UPDATE productos SET nombre='OZOAGRO 1 Litro', precio_venta=129900, updated_at=now() WHERE litros=1;
UPDATE productos SET activo=false, updated_at=now() WHERE litros IN (2,3);
INSERT INTO productos (nombre, litros, precio_venta, costo_unitario, activo)
SELECT v.n, v.l, v.p, v.l*36000, true FROM (VALUES ('Galón (4 L)',4,409900),('10 Unidades (10 L)',10,1100000),('20 Unidades (20 L)',20,1998000)) v(n,l,p)
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE litros=v.l);
UPDATE productos SET precio_venta = v.p, nombre=v.n, activo=true, updated_at=now() FROM (VALUES ('Galón (4 L)',4,409900),('10 Unidades (10 L)',10,1100000),('20 Unidades (20 L)',20,1998000)) v(n,l,p) WHERE productos.litros=v.l;

-- 2. Regla de precio: primero el producto activo con ese litraje (1,4,10,20); si no existe, N x precio_litro_extra
CREATE OR REPLACE FUNCTION public.precio_total_litros(p_litros integer)
 RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_extra numeric; v_precio numeric;
BEGIN
  IF COALESCE(p_litros,0) <= 0 THEN RETURN 0; END IF;
  SELECT precio_venta INTO v_precio FROM productos WHERE litros = p_litros AND activo ORDER BY updated_at DESC LIMIT 1;
  IF v_precio IS NOT NULL THEN RETURN v_precio; END IF;
  SELECT precio_litro_extra INTO v_extra FROM config_negocio LIMIT 1;
  RETURN p_litros * COALESCE(v_extra, 100000);
END $function$;

-- 3. RESEÑAS de visitantes (widget de la landing)
CREATE TABLE IF NOT EXISTS public.resenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ciudad text,
  cultivo text,
  estrellas int NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 20 AND 600),
  foto_url text,
  telefono text,
  origen text NOT NULL DEFAULT 'landing',
  aprobada boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resenas FROM anon, authenticated, public;
GRANT SELECT, UPDATE ON public.resenas TO authenticated;
DROP POLICY IF EXISTS resenas_auth_all ON public.resenas;
CREATE POLICY resenas_auth_all ON public.resenas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.resenas_publicas(p_limit int DEFAULT 12)
 RETURNS TABLE(id uuid, nombre text, ciudad text, cultivo text, estrellas int, texto text, foto_url text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT id, nombre, ciudad, cultivo, estrellas, texto, foto_url, created_at
  FROM resenas WHERE aprobada ORDER BY created_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,12),1),50);
$fn$;

CREATE OR REPLACE FUNCTION public.crear_resena(p_nombre text, p_ciudad text, p_cultivo text, p_estrellas int, p_texto text, p_telefono text DEFAULT NULL)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id uuid; v_nombre text := left(trim(COALESCE(p_nombre,'')),60); v_texto text := trim(COALESCE(p_texto,''));
        v_tel text := NULLIF(regexp_replace(COALESCE(p_telefono,''),'\D','','g'),'');
BEGIN
  IF char_length(v_nombre) < 2 THEN RETURN json_build_object('error','Escribe tu nombre'); END IF;
  IF p_estrellas IS NULL OR p_estrellas NOT BETWEEN 1 AND 5 THEN RETURN json_build_object('error','Selecciona de 1 a 5 estrellas'); END IF;
  IF char_length(v_texto) < 20 THEN RETURN json_build_object('error','Cuéntanos un poco más (mínimo 20 caracteres)'); END IF;
  IF char_length(v_texto) > 600 THEN RETURN json_build_object('error','Máximo 600 caracteres'); END IF;
  IF v_texto ~* '(https?://|www\.)' THEN RETURN json_build_object('error','La reseña no puede contener enlaces'); END IF;
  -- anti-spam: máximo 20 reseñas por hora en total y 1 por teléfono cada 24 h
  IF (SELECT count(*) FROM resenas WHERE created_at > now() - interval '1 hour') >= 20 THEN RETURN json_build_object('error','Estamos recibiendo muchas reseñas, intenta más tarde'); END IF;
  IF v_tel IS NOT NULL AND EXISTS (SELECT 1 FROM resenas WHERE telefono = v_tel AND created_at > now() - interval '24 hours') THEN
    RETURN json_build_object('error','Ya registramos una reseña con este teléfono hoy');
  END IF;
  INSERT INTO resenas (nombre, ciudad, cultivo, estrellas, texto, telefono, origen)
  VALUES (v_nombre, left(trim(COALESCE(p_ciudad,'')),60), left(trim(COALESCE(p_cultivo,'')),60), p_estrellas, v_texto, v_tel, 'landing')
  RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END $fn$;
REVOKE ALL ON FUNCTION public.resenas_publicas(int) FROM public;
REVOKE ALL ON FUNCTION public.crear_resena(text,text,text,int,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.resenas_publicas(int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crear_resena(text,text,text,int,text,text) TO anon, authenticated, service_role;

-- 4. Semilla: las 6 reseñas que ya traía la landing del programador (fotos reales del ZIP)
INSERT INTO resenas (nombre, ciudad, cultivo, estrellas, texto, foto_url, origen, created_at)
SELECT * FROM (VALUES
 ('Jorge Martínez','Huila','Cultivo de café',5,'Me ha gustado la facilidad para aplicarlo y lo práctico que resulta para el manejo del cultivo.','images/p1.png','semilla',now()-interval '41 days'),
 ('Carlos Ramírez','Valle del Cauca','Banano',5,'Es fácil de preparar y de aplicar. Lo he incorporado a la rutina de manejo de mis cultivos.','images/p2.png','semilla',now()-interval '36 days'),
 ('Andrés López','Antioquia','Pimentón',5,'La aplicación es sencilla y puedo utilizarlo tanto por riego como de forma foliar.','images/p3.png','semilla',now()-interval '29 days'),
 ('Luis Fernando','Tolima','Cultivo de limón',5,'Me parece una alternativa práctica para complementar el manejo que hacemos en el cultivo.','images/ozo1.png','semilla',now()-interval '22 days'),
 ('Diego Pérez','Santander','Cultivo agrícola',5,'Lo que más me gusta es que la preparación es rápida y no requiere un proceso complicado.','images/ozo2.png','semilla',now()-interval '15 days'),
 ('Wilson Rodríguez','Norte de Santander','Cultivo agrícola',5,'Una opción sencilla de incorporar al trabajo diario del cultivo. La aplicación resulta muy práctica.','images/ozo3.png','semilla',now()-interval '8 days')
) v(n,c,k,e,t,f,o,d) WHERE NOT EXISTS (SELECT 1 FROM resenas WHERE origen='semilla');
COMMIT;
