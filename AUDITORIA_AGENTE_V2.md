# Auditoria Agente Andres v2 - OZOAGRO

**Fecha:** 2026-08-30
**Workflow ID:** 4KA11Mhc7Qs4HzDt
**Estado:** ACTIVO

## Resumen de cambios v2

1. **Prompt mejorado**: Venta consultiva con preguntas abiertas, trato de "usted" colombiano, se presenta una sola vez
2. **Debounce 6s**: Agrupa rafagas de mensajes del mismo cliente antes de responder
3. **Videos con pregunta**: Pregunta cual video quiere antes de enviar (pepino/papaya/sandia)
4. **Fix bug respuestas vacias**: Nodo "Registrar saliente" ahora usa referencia absoluta `$('Parsear respuesta')` en vez de `$json`
5. **Tags de datos**: [DATO_NOMBRE:], [DATO_CIUDAD:], [DATO_DEPTO:], [DATO_CULTIVO:] para capturar info del lead
6. **Tag de pedido**: [CREAR_PEDIDO:{json}] para cerrar pedidos desde el agente
7. **Memoria 30 mensajes**: Ventana de contexto aumentada
8. **Hora Colombia**: Inyectada al prompt para saludos contextuales

## Verificaciones completadas

| Item | Estado | Evidencia |
|------|--------|-----------|
| Archivos media | OK | 4/4 responden 200 (producto.jpg, video_pepino.mp4, video_papaya.mp4, video_sandia.mp4) |
| Workflow actualizado | OK | PUT exitoso, 26 nodos |
| Workflow activo | OK | active: true |
| Webhook path | OK | /webhook/whatsapp-aimma (sin cambio) |
| Credenciales | OK | AIMMA OpenAI + AIMMA Meta WhatsApp Token referenciadas |

## PENDIENTE - Requiere accion de Jorge

### 1. Aplicar migracion SQL en Supabase

El archivo `supabase/migrations/20260830_agente_v2_rpcs.sql` contiene:

- Columnas nuevas en `wa_conversaciones`: ciudad, departamento, cultivo
- RPC `actualizar_lead()`: Actualiza datos del lead desde tags del agente
- RPC `crear_pedido_agente()`: Crea pedido cerrado por el agente (canal='agente', estado='por_confirmar')

**Como aplicar:**
1. Ir a https://supabase.com/dashboard/project/vlcxeajnucdkwamcivgy
2. SQL Editor
3. Copiar y ejecutar el contenido de `supabase/migrations/20260830_agente_v2_rpcs.sql`

**IMPORTANTE:** Sin estas RPCs, los nodos "Guardar datos lead" y "Crear pedido agente" fallaran (con onError: continue, no tumba el flujo pero no guarda los datos).

### 2. Discrepancia de precios - CONFIRMAR CON CEO GOMEZ

| Fuente | Precio 2L |
|--------|-----------|
| Landing web | $220,000 (ahorra $40,000) |
| Prompt v2 agente | $220,000 (ahorra $40,000) |
| BD productos | $250,000 |

**Cual es el precio correcto?**
- Si es $220,000: Actualizar en BD: `UPDATE productos SET precio_venta = 220000 WHERE litros = 2;`
- Si es $250,000: Actualizar prompt del agente en n8n

### 3. Prueba de conversacion real

Enviar mensaje de WhatsApp al +57... (numero de OZOAGRO) y verificar:
- [ ] Saludo contextual (Buenos dias/tardes segun hora)
- [ ] Se presenta una sola vez
- [ ] Pregunta cual video quiere antes de enviar
- [ ] Respuestas guardadas en wa_mensajes con contenido
- [ ] Debounce: enviar 3 mensajes rapido, recibir UNA respuesta
- [ ] Cierre de pedido: datos capturados y pedido en panel

## Archivos modificados

- `n8n/OZOAGRO_Agente_Andres_v2.json` (original de Fable)
- `supabase/migrations/20260830_agente_v2_rpcs.sql` (nuevo)

## Credenciales (ya configuradas en n8n)

- OpenAI: Gy1kSNlEmpsaTTwE (AIMMA OpenAI)
- WhatsApp: HxFbYAP7T9Wi7vGc (AIMMA Meta WhatsApp Token)
- Supabase service_role: hardcoded en nodos HTTP (migrar a credential en fase posterior)

## Siguiente fase

- Bot Telegram para CEO: trigger Telegram que consulta RPCs del panel (ventas, pedidos, balance, etc.)
- Memoria Postgres: Migrar de memoryBufferWindow (RAM) a Postgres Chat Memory para persistencia
