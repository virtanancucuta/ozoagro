# OZOAGRO — Módulo DISTRIBUIDORES (multi-tenant) — Diseño

Fecha: 2026-09-07 · Estado: PARA REVISIÓN DE JORGE · Autor: Claude (Fable 5.1) con decisiones de Jorge Valbuena

## 1. Objetivo

Que OZOAGRO (CEO Andrés) pueda crear distribuidores desde el panel. Cada distribuidor tiene:
- Su propio panel en ozoagro.co/panel con el mismo código de hoy: Pedidos, Ventas, Inventario (stock propio), Gastos, CRM, Balance, Configuración (solo su WhatsApp y datos).
- Su propia landing en ozoagro.co/{slug} (ej. ozoagro.co/andres): idéntica a la oficial, precios al detal, WhatsApp del distribuidor, pedidos que llegan a SU panel.
- Chats IA: pantalla "Por desarrollar. Contacta a tu CEO para activarlo" + guía paso a paso de WhatsApp Business (mensajes automáticos y catálogo).
- Ningún distribuidor ve datos de otro. El CEO ve todo lo suyo y, aparte, un módulo DISTRIBUIDORES con pestañas Crear / Ventas por distribuidor / CRM y clientes por distribuidor.

Decisiones de Jorge (2026-09-07):
- El distribuidor maneja su propio stock, gastos, ventas, CRM y balance.
- Las ventas de distribuidores NO cuentan en las ventas del CEO; se ven aparte en DISTRIBUIDORES.
- El correo de "nuevo pedido" de un distribuidor NO le llega al CEO (le llega al distribuidor si tiene correo).
- Bot en el número del distribuidor: no se desarrolla. Se reemplaza por guía de WhatsApp Business y el mensaje "contacta a tu CEO".

## 2. Estado actual (verificado)

- Supabase `vlcxeajnucdkwamcivgy`. 1 usuario en `auth.users` (ceo@ozoagro.co).
- 16 tablas con RLS activo, pero TODAS las políticas son `authenticated USING (true)`: cualquier usuario autenticado ve y edita todo. Hoy no existe aislamiento.
- El panel consulta tablas directamente (44 llamadas `.from()` en 8 módulos) y usa 7 RPC `SECURITY DEFINER` (`ventas_resumen`, `balance_resumen`, `cobertura_stock`, `crm_clientes`, `crm_visitas`, `chats_ia_resumen`, `chats_ia_marcar`). Las RPC SECURITY DEFINER **saltan el RLS**: deben filtrar por distribuidor por dentro.
- Landing estática; pedido entra por `crear_pedido_web(...)` (SECURITY DEFINER, anon). Visitas y carritos por `registrar_visita` / `registrar_carrito_abandonado`.
- Correos: trigger `trg_pedidos_correos` → `disparar_correo_pedido()` → Edge Function `ozoagro-correos` → Resend, con `email_ceo` de `config_negocio`.
- nginx: `location /` sirve `index.html` para cualquier ruta no existente (base para `/{slug}`); `/panel` aparte.
- Copia GitHub Pages (`virtanancucuta.github.io/ozoagro`): NO soporta `/{slug}` (solo Easypanel).

## 3. Lo que falta en el backend (fase 1 — migración, requiere OK explícito)

### 3.1 Tablas y columnas
- `distribuidores` (id uuid, slug text UNIQUE, nombre, cedula, ciudad, telefono, whatsapp, email, auth_user_id uuid UNIQUE → auth.users, activo bool, notas, created_at, updated_at). Slugs reservados: panel, images, videos, js, api, admin, ozoagro.
- `distribuidor_id uuid NULL` (FK → distribuidores) en: `pedidos`, `clientes`, `gastos`, `inventario`, `visitas`, `checkouts_abandonados`, `productos_costo_historial` (no), `correos_enviados` (heredado del pedido). NULL = OZOAGRO central (CEO). Los datos actuales quedan con NULL → siguen siendo del CEO.
- Índices por `distribuidor_id` en pedidos, clientes, gastos, inventario, visitas.

### 3.2 Funciones de contexto (STABLE, usadas por las políticas)
- `mi_distribuidor_id()` → uuid o NULL: busca `distribuidores.auth_user_id = auth.uid()`.
- `es_ceo()` → bool: `auth.uid()` = usuario CEO (por email `ceo@ozoagro.co` o por ausencia de fila en distribuidores; se fija en tabla `admins(auth_user_id)` para no depender del email).

### 3.3 RLS (reemplaza `USING(true)` en las tablas con tenant)
- pedidos, clientes, gastos, inventario, visitas, checkouts_abandonados, pedido_items (vía pedido):
  `USING (es_ceo() OR distribuidor_id IS NOT DISTINCT FROM mi_distribuidor_id())` y `WITH CHECK` igual (el distribuidor solo puede insertar con SU id; un trigger `BEFORE INSERT` pone `distribuidor_id = mi_distribuidor_id()` si viene NULL y el usuario es distribuidor).
- productos: SELECT para todos los autenticados; INSERT/UPDATE/DELETE solo `es_ceo()`.
- config_negocio: SELECT todos (necesitan whatsapp/textos); UPDATE solo CEO.
- wa_conversaciones, wa_mensajes, agente_acciones_ceo, resenas, correos_enviados, productos_costo_historial: solo CEO (el distribuidor no las usa).
- distribuidores: CEO todo; el distribuidor SELECT/UPDATE de su propia fila y solo columnas whatsapp/telefono/email/ciudad (UPDATE con `WITH CHECK (id = mi_distribuidor_id())` + trigger que impide cambiar slug/activo/auth_user_id).

### 3.4 RPC (todas pasan a filtrar por tenant por dentro)
- `ventas_resumen`, `balance_resumen`, `cobertura_stock`, `crm_clientes`, `crm_visitas`: nuevo parámetro opcional `p_distribuidor_id uuid DEFAULT NULL`. Regla: si el que llama es distribuidor, se fuerza SU id (ignora el parámetro); si es CEO y el parámetro es NULL → solo filas con `distribuidor_id IS NULL` (ventas propias, como pidió Jorge); si es CEO y manda un id → ese distribuidor (pestaña Ventas/CRM por distribuidor). Recrear con DROP+CREATE (cambia la firma; lección AIMMA).
- `chats_ia_resumen` / `chats_ia_marcar`: solo CEO (RAISE si distribuidor).
- `crear_pedido_web`: nuevo `p_distribuidor_slug text DEFAULT NULL` → resuelve id (solo activos), asigna `distribuidor_id` a pedido y cliente. El cliente se busca por teléfono **dentro del mismo distribuidor** (un mismo teléfono puede ser cliente del CEO y de un distribuidor sin mezclarse).
- `registrar_visita` y `registrar_carrito_abandonado`: `p_distribuidor_slug` opcional → `distribuidor_id`.
- `crear_pedido_agente`: sin cambios (siempre CEO).
- Nuevas: `mi_perfil()` → {rol: 'ceo'|'distribuidor', nombre, slug, whatsapp, distribuidor_id}; `distribuidor_publico(p_slug)` (anon) → {nombre, ciudad, whatsapp} solo si activo; `distribuidores_resumen()` (CEO) → lista con KPIs (pedidos, ventas cerradas, clientes, última venta); `crear_distribuidor(...)` NO va en SQL: va en Edge Function (3.6).
- `precio_total_litros`: sin cambios (precios al detal iguales para todos).

### 3.5 Correos
- `disparar_correo_pedido`: si el pedido tiene `distribuidor_id` → destinatario interno = `distribuidores.email` (si existe) y NO `email_ceo`; el correo al cliente se mantiene (remitente OZOAGRO). Texto "tu asesor: {nombre distribuidor} · WhatsApp {whatsapp}".

### 3.6 Edge Function `ozoagro-distribuidores` (service_role, verify_jwt = true)
- Acciones: `crear` (valida que el que llama es CEO por su JWT; crea usuario en Auth con email interno `{usuario}@distribuidores.ozoagro.co` y clave dada, `email_confirm = true`; inserta en `distribuidores`), `resetear_clave`, `desactivar` (deshabilita login: `ban_duration` + `activo=false`).
- Motivo: crear usuarios exige service_role; nunca en el navegador.

### 3.7 Prueba de aislamiento (gate de la fase 1)
- Crear 2 distribuidores de prueba (es_test) + pedidos/clientes/gastos/inventario de cada uno.
- Consultar como cada usuario (JWT real, no como postgres): distribuidor A no ve nada de B ni del CEO en NINGUNA tabla ni RPC; CEO ve lo suyo con `p_distribuidor_id NULL` y lo de A con su id. Intento de insertar con `distribuidor_id` ajeno → rechazado.
- Verificar grants post-apply (lección: revoke a public/anon no basta).

## 4. Panel (fase 2 — solo código aditivo)

- `app.js`: tras login llama `mi_perfil()`; guarda `window.PERFIL`. Si distribuidor: oculta "Chats IA" y sustituye por pantalla estática "Chat IA — Por desarrollar" (texto "Contacta a tu CEO para activarlo" + guía WhatsApp Business); "Configuración" muestra solo: nombre, ciudad, teléfono, **WhatsApp de tu landing**, correo, y el enlace `ozoagro.co/{slug}` con botón copiar. Título del panel "Panel {nombre distribuidor}".
- Módulos existentes: sin cambios funcionales; el RLS filtra. Las llamadas a RPC pasan `p_distribuidor_id` solo desde el módulo DISTRIBUIDORES.
- Nuevo módulo `distribuidores.js` (solo CEO), pestañas:
  - **Crear**: formulario nombre, cédula, ciudad, teléfono, WhatsApp, correo (opcional), usuario, clave, slug (auto desde el nombre, editable, validación de reservados y unicidad) → Edge Function. Lista con estado, enlace de landing, resetear clave, desactivar.
  - **Ventas**: selector de distribuidor + rango de fechas → `ventas_resumen(p_distribuidor_id)` + tabla de pedidos del distribuidor (consulta directa con filtro; el CEO sí ve todo por RLS).
  - **CRM y clientes**: selector de distribuidor → `crm_clientes(p_distribuidor_id)` + Excel.
- Guía WhatsApp Business (pantalla estática en el panel del distribuidor): 1) instalar WhatsApp Business, 2) perfil de empresa, 3) mensaje de bienvenida, 4) mensaje de ausencia, 5) respuestas rápidas con los 4 precios, 6) catálogo con las 4 presentaciones y fotos (las mismas de la landing), 7) enlace corto wa.me y cómo pegarlo en su configuración del panel. Nota clara: un bot automático real requiere la API oficial de Meta (verificación + costo), se cotiza aparte con AIMMA.
- Subir `?v=` de los scripts.

## 5. Landing por distribuidor (fase 3)

- nginx: `location ~ "^/([a-z0-9-]{3,30})/?$" { try_files $uri /index.html; }` antes de `location /` (los archivos reales ganan por `$uri`; `/panel` sigue aparte).
- `js/conexion.js`: `slug = location.pathname.split('/')[1]`; si hay slug → `distribuidor_publico(slug)`; si existe: reemplaza TODOS los `wa.me/573145933481` por el WhatsApp del distribuidor (header, CTA final, flotante, footer, mensaje de éxito), muestra una franja discreta "Tu asesor OZOAGRO: {nombre} · {ciudad}" bajo el header, y manda `p_distribuidor_slug` en pedido, visita y carrito. Si el slug no existe o está inactivo → landing oficial (sin error).
- Píxel: mismo píxel; el evento Purchase lleva `content_name` + `distribuidor` como parámetro personalizado.
- `<link rel="canonical" href="https://ozoagro.co/">` en la landing para que Google no indexe /andres como duplicado.
- GitHub Pages: sin cambios (no soporta slugs; solo Easypanel).

## 6. Pruebas de punta a punta (fase 4, gate final)

- Playwright: pedido real desde ozoagro.co/{slug-prueba} (escritorio + iPhone + Android) → aparece en el panel del distribuidor de prueba y en DISTRIBUIDORES > Ventas del CEO; NO aparece en Pedidos del CEO ni en el panel del otro distribuidor. WhatsApp de la landing = el del distribuidor. Correo interno al distribuidor, no al CEO.
- Luego: borrar los distribuidores de prueba (o dejarlos `es_test`).

## 7. Riesgos y decisiones abiertas

- Las RPC SECURITY DEFINER son el punto crítico: cualquiera que olvide el filtro filtra datos entre distribuidores. Se prueban una por una como actor sin privilegio.
- Clientes: el mismo teléfono puede existir en dos tenants; el CRM del CEO no mezcla. Si un día se quiere "cliente global", es otra fase.
- Inventario: `cobertura_stock` pasa a calcular por tenant; el stock del CEO no descuenta ventas de distribuidores.
- Slugs: minúsculas, sin tildes, 3–30 caracteres, únicos.
- El bot lineal en número propio del distribuidor queda fuera: sin la API oficial de Meta no hay forma legítima de automatizar respuestas en un número (las librerías no oficiales violan los términos y Meta bloquea el número).

## 8. Estimación

Fase 1 (BD + aislamiento probado): 1 sesión. Fase 2 (panel + EF): 1 sesión. Fase 3 (landing + nginx) + Fase 4 (E2E): media sesión. Total: 2,5 sesiones. Cada fase termina con verificación y commit; Jorge hace Rebuild al final de la fase 2 y de la 3.
