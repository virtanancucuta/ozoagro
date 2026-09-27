# OZOAGRO — Agente Andrés v11: vende + recluta distribuidores + sigue conectado al panel

Fecha: 2026-09-27 · Estado: EJECUTADO (Jorge pidió "dale hasta el final, al final revisamos") · Autor: Claude (Fable 5.1)

## 1. Pedido de Jorge
Mejorar el agente Andrés (n8n `4KA11Mhc7Qs4HzDt`, WhatsApp 573133623071) para que:
1. Siga conectado al panel (Chats IA, leads, pedidos).
2. Genere ventas a clientes (ya lo hacía: tag `[CREAR_PEDIDO]` → `crear_pedido_agente`).
3. Ofrezca a quien le interese ser DISTRIBUIDOR de OZOAGRO con sus beneficios reales: mejores precios (precio mayorista), panel de gestión del negocio (ventas, gastos, rentabilidad, balance, CRM, inventario) y su propia web ya construida (ozoagro.co/{slug}).
4. Todo probado y auditado.

"Prompt manual del CEO": no llegó ningún archivo ni texto nuevo (buscado en Escritorio, Descargas y el repo; el único prompt es `n8n/PROMPT_ANDRES_CASTRO.md` = el vivo v10). Se trabajó sobre el v10 vivo. Cuando Jorge comparta el prompt del CEO se fusiona.

## 2. Estado verificado antes de tocar (2026-09-27)
- Flujo vivo v10 (34 nodos, prompt idéntico al del repo), activo, gpt-4.1-mini, memoria Postgres `_v8_20260831` de 30 mensajes.
- BD `vlcxeajnucdkwamcivgy`: 0 pedidos, 0 clientes, 0 distribuidores, 2 conversaciones (Alfredo real + Jorge). Productos activos 1/4/10/20 L; `precio_mayorista` solo en 1 L ($65.000 vs $129.900 público); el resto NULL.
- Landing viva: sección "¿Quieres ser distribuidor?" con 5 beneficios (calidad +10 años, panel empresarial gratis, tu propia página web, control total ventas/rentabilidad/gastos/balance, CRM). Botón "Quiero ser distribuidor" va al WhatsApp humano 573145933481, no al bot.
- **BUG 1 (real):** los 4 archivos de media del agente (`/media/producto.jpg` + 3 videos) responden 404 desde la landing nueva del 2026-09-07: el agente promete foto/video y Meta no puede enviarlos. Estaban en git (`1bc650e`) en `landing/media/`.
- **BUG 2 (real, hoy 17:54):** cliente real (Alfredo) mandó un audio; Whisper devolvió la alucinación "Subtítulos realizados por la comunidad de Amara.org" y el agente respondió sobre eso.
- `wa_conversaciones.metadata jsonb` existe y está vacío (`{}`) → sirve para guardar el interés sin migración.

## 3. Diseño (aditivo, sin migración de BD)
### Agente (n8n, Tipo A: lo despliego yo por API)
- **Prompt v11**: nueva sección "SER DISTRIBUIDOR" (cuándo ofrecerlo, beneficios exactos, qué NO prometer, captura de datos y tag `[INTERES_DISTRIBUIDOR:{json}]`), regla para audio no entendible, y bloque de precio mayorista inyectado desde la BD (`{{ $('Armar precios').first().json.distribuidor }}`).
- **Precios actuales**: añade `precio_mayorista` al select (service_role; el costo de fabricación NO se consulta).
- **Armar precios**: nuevo campo `distribuidor` = texto con los precios mayoristas fijados (los NULL → "lo confirma el equipo").
- **Unir texto**: filtro de alucinaciones de Whisper (Amara, "gracias por ver", vacío) → texto `(nota de voz que no se entendió)` y el prompt pide que la repita.
- **Parsear respuesta**: parsea y limpia `[INTERES_DISTRIBUIDOR:...]` → `interes`, `tiene_interes`.
- **Nodos nuevos**: `Hay interes distribuidor?` (IF) → `Leer conversacion` (GET metadata) → `Fusionar interes` (Code: merge + primera_vez/actualizado/veces/estado) → `Guardar interes distribuidor` (PATCH `wa_conversaciones.metadata.interes_distribuidor`).
- **Preparar media**: base `https://ozoagro.co/media/` (archivos restaurados en el repo; producto.jpg ahora es el flyer 1080×1350 con el precio vivo).
- Memoria: `sessionKey` → `_v11_20260927` (prompt nuevo = contexto nuevo).
### Panel (repo, Tipo B: Jorge hace Rebuild)
- `chats.js`: el CEO ve badge "Quiere ser distribuidor", pestaña "Distribuidor", KPI, detalle en el modal (negocio, zona, correo) con botón a Distribuidores › Crear, y columnas en el Excel. Lee `wa_conversaciones.metadata` (RLS `es_ceo()`).
- `index.html`: `chats.js?v=20260927a`.
- `landing/media/*` restaurados.

## 4. Pruebas
Disparando el webhook en modo test (`wamid.TEST_`, números ficticios; no sale nada a Meta, todo queda en BD): precio por hectáreas (regresión), "quiero ser distribuidor" (beneficios + captura + tag + metadata), señal indirecta (almacén agrícola), pedido completo (regresión), audio no entendible (unitario), intento de sacar información interna. Panel probado con Playwright (login CEO) contra la BD real. Al final se retiran los datos de prueba y se deja la BD como estaba.
