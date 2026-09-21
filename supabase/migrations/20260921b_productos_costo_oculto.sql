-- =====================================================================
-- OZOAGRO — cerrojo: el costo de OZOAGRO y el precio mayorista no salen por la API a anon/authenticated
-- 2026-09-21 · APLICAR SOLO DESPUÉS del Rebuild del panel con 20260921_mayorista_cedi (el panel viejo hace select * en productos).
-- El panel nuevo lee productos por productos_panel(); la landing y el agente piden columnas explícitas (sin costo).
-- OJO: un REVOKE por columna no quita nada si el rol tiene SELECT sobre la tabla → se quita el SELECT de tabla y se concede por columnas.
-- =====================================================================
BEGIN;
REVOKE SELECT ON public.productos FROM anon, authenticated;
GRANT SELECT (id, nombre, litros, precio_venta, activo, created_at, updated_at) ON public.productos TO anon, authenticated;
COMMIT;
