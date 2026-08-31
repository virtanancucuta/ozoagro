-- 2026-08-31 — Agente Andres v4: debounce robusto
-- APLICADA en Supabase vlcxeajnucdkwamcivgy el 2026-08-31 01:39 UTC (con OK de Jorge).
-- Cambios: ventana maxima de 3 min (no arrastra mensajes viejos tras una caida),
-- es_ultimo por id de mensaje (dos mensajes iguales seguidos ya no responden dos veces),
-- grants solo service_role.
DROP FUNCTION IF EXISTS public.mensajes_pendientes(text, text);
CREATE OR REPLACE FUNCTION public.mensajes_pendientes(p_telefono text, p_contenido text, p_msg_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_conv uuid; v_ultimo_id uuid; v_ultimo_txt text; v_corte timestamptz; v_texto text; v_es_ultimo boolean;
BEGIN
  SELECT id INTO v_conv FROM wa_conversaciones WHERE telefono = p_telefono;
  IF v_conv IS NULL THEN
    RETURN jsonb_build_object('es_ultimo', true, 'texto', COALESCE(p_contenido,''));
  END IF;
  SELECT id, contenido INTO v_ultimo_id, v_ultimo_txt
  FROM wa_mensajes WHERE conversacion_id = v_conv AND rol = 'user'
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT GREATEST(COALESCE(max(created_at), '-infinity'::timestamptz), now() - interval '3 minutes')
  INTO v_corte FROM wa_mensajes WHERE conversacion_id = v_conv AND rol = 'assistant';
  SELECT string_agg(contenido, E'\n' ORDER BY created_at, id) INTO v_texto
  FROM wa_mensajes WHERE conversacion_id = v_conv AND rol = 'user' AND created_at > v_corte;
  v_es_ultimo := CASE WHEN p_msg_id IS NOT NULL THEN (v_ultimo_id = p_msg_id)
                      ELSE (v_ultimo_txt IS NOT DISTINCT FROM p_contenido) END;
  RETURN jsonb_build_object('es_ultimo', COALESCE(v_es_ultimo, false), 'texto', COALESCE(v_texto, p_contenido, ''));
END $function$;
REVOKE ALL ON FUNCTION public.mensajes_pendientes(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mensajes_pendientes(text, text, uuid) TO service_role;
