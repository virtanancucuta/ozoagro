# Auditoría Agente Andrés v14 — manual del CEO + ficha técnica + redes (2026-10-12)

**Workflow:** `4KA11Mhc7Qs4HzDt` · "OZOAGRO WhatsApp - Agente Andres v14" · ACTIVO · 51 nodos · modelo `gpt-4.1` (temp 0,4) · memoria `_v14_20261012`.
**Build:** `scripts/build_agente_v14.py` (base = `n8n/OZOAGRO_WHATSAPP.json` de `f26317a`, reproducible: build desde git == vivo). Prompt: `n8n/PROMPT_ANDRES_V14.md`.

## Decisiones (aprobadas por Jorge el 2026-10-12)
| Tema | Decisión |
|---|---|
| Dosis | **La de la ficha técnica: 0,35–0,5 L por tanque de 200 L** (decisión de Jorge, 2026-10-12, tarde). Bomba de 20 L = 35–50 ml; 1 L = 2 a 2,8 tanques. Para calcular cantidad se usa la dosis alta (0,5 L) para que no falte producto. |
| Precios | Los de la BD (Inventario), no la tabla de descuentos del manual. 50 L o más → "precio especial, lo cotiza el equipo". |
| Envío | Sigue gratis + contraentrega. |
| Afirmaciones | Lenguaje prudente del manual: virus = no es cura; abejas = depende de condiciones; sin "8 países / 10.000 productores / 10 años"; días de carencia, residuos y certificaciones → "se lo confirmamos con la documentación". |
| Nombre y trato | "Ingeniero Andrés", de usted. |
| Descuento 10 % pago anticipado | No incluido. |
| Ficha con "$26.50 PVP" (Ecuador) | Se envía tal cual. |
| Redes | Una vez por conversación, al cierre. |

## Cambios
1. **Prompt nuevo**: saludo del CEO (hora + Ingeniero Andrés + cultivo/zona/problema + fotos), diagnóstico progresivo, hongos/bacterias/virus/insectos/abejas, dosis con litros de agua por hectárea, mezclas (prueba de compatibilidad), competencia, testimonios sin inventar, objeciones del manual, datos de la ficha (composición neem + ricino, almacenamiento 6 meses, EPP). Bloque "REGLAS DE ORO" al inicio (precio pedido = precio dado, ≥50 L cotiza el equipo, lenguaje prudente, ficha solo con sí, brevedad).
2. **Ficha técnica PDF** (`landing/media/ficha_tecnica_ozoagro.pdf`, servida por GitHub Pages): tag `[ENVIAR_FICHA]` + candado en el flujo: solo sale si el agente la ofreció en su mensaje anterior o el cliente la pidió.
3. **Redes al cierre**: tag `[ENVIAR_REDES]` o pedido registrado → mensaje aparte con web, Facebook, Instagram y TikTok; una sola vez (`metadata.redes_enviadas`).
4. **Envíos extra en un solo camino ordenado** (`Leer contexto envios → Preparar envios → Envio real? → Enviar media`, de a uno cada 2,5 s): foto/video → ficha → redes. Se registran en `wa_mensajes` (se ven en Chats IA). Reemplaza `Hay media?` + `Preparar media`.
5. **`Estado conversacion`** antes del agente: le dice si ya se enviaron redes/ficha (evita "le dejo nuestras redes" repetido).
6. `Armar precios`: rendimiento expresado en tanques de 200 L (ya no "1 L = 1 hectárea").
7. Modelo `gpt-4.1-mini` → `gpt-4.1`, temperatura 0,6 → 0,4.

## Por qué gpt-4.1 (medido)
Con mini, a "tengo N hectáreas, ¿cuánto vale?" respondía solo con la pregunta del agua (falló 2 de 3 aun con regla de oro y ejemplo) y para 60 L dio un total en vez de pasar a cotización (1 de 2). Con gpt-4.1: 4/4 y 2/2. Costo medido en 40 llamadas: ~8.200 tokens de entrada y ~130 de salida por mensaje → **USD 0,017 por mensaje** (mini USD 0,0035): ~USD 17 por cada 1.000 mensajes. Volver a mini: `--modelo=gpt-4.1-mini`.

## Pruebas
- Nodos Code: `node scripts/test_agente_v14_nodes.cjs scripts/ozo_v14.json` → 15/15.
- E2E modo test (`scripts/test_agente_v14.py`, webhook real, verificado en BD) con gpt-4.1: saludo, dosis (3 ha × 300 L = 4,5 L → galón + litro), virus+abejas, mezcla, ficha sí (PDF registrado), ficha no (no envía), pedido (OZO creado + redes; despedida sin repetir redes), caro, "lo voy a pensar" (redes), 60 L y 100 L (cotiza el equipo), precio con hectáreas ×3, distribuidor (interés guardado + redes), foto roya (prudente), seguridad. Sin errores en las últimas 40 ejecuciones.
- No probado de punta a punta: la **entrega real en WhatsApp** del PDF y de las redes (modo test no llama a Meta). Probar con un número real al conectar la API de OZOAGRO.

## Observaciones
- A veces separa el mensaje en 2–3 párrafos (la regla de brevedad no se cumple siempre).
- Las pruebas de pedido disparan el correo interno real a ozoagro.ceo@gmail.com (trigger `trg_pedidos_correos`): hoy llegaron 4 correos "Nuevo pedido OZO-0000X · Pedro Pérez" de prueba. Propuesta (requiere OK, es cambio de BD): que el trigger no envíe correos para teléfonos de prueba `57300000%`.

## Limpieza para producción (2026-10-12)
Respaldo en `Desktop\OZOAGRO_RESPALDO_2026-10-12\` y borrado: 19 conversaciones / 227 mensajes / 86 memorias del agente / 1 pedido / 1 cliente / 5 correos de prueba. `pedidos_codigo_seq` reiniciada (el primer pedido real será OZO-00001). Distribuidores: ya estaban en 0. Visitas de la landing (15) no se tocaron.

## Revisión de código del backend (2026-10-12, /code-review) — corregido y re-probado
1. **SSRF** en la imagen de prueba (preexistente desde v12): el webhook es público y `wamid.TEST_` + `image.link` hacía que n8n descargara cualquier URL. Ahora solo `https://(upload|thumb|commons).wikimedia.org/...` (regex: el sandbox de Code de n8n no trae `URL()`, que bloqueaba todo); link no permitido = "foto que no se pudo analizar" (antes caía a Meta con id falso y no respondía).
2. Leer la conversación falla → ya no salen ficha ni redes ni se pisa `metadata` (fallar cerrado).
3. Candado de la ficha ignoraba que los registros "[Video ... enviado]" / "[Ficha ... enviada]" son filas `assistant`: ahora se filtran.
4. Registro y marcas solo tras envío exitoso a Meta (`Enviar media` con salida de error; `Confirmar envios` → `Registrar envios` + `Unir marcas` → una sola escritura de metadata con `updated_at`).
5. Redes ya no salen con un `[CREAR_PEDIDO]` mal formado.
6. `--modelo` por defecto = gpt-4.1 (antes un rebuild sin flag bajaba a mini).
Pruebas: 29/29 nodos; E2E foto, ficha sí/no, distribuidor, pensar, saludo, precio OK.

**Pendientes de la revisión (no aplicados):**
- **Firma de Meta (`X-Hub-Signature-256`) no se valida**: cualquiera puede mandar mensajes falsos al webhook. Hacerlo al conectar la app de OZOAGRO (requiere su App Secret).
- Registrar los envíos extra corre el corte de `mensajes_pendientes` unos segundos (si el cliente escribe 2 mensajes mientras salen ficha/redes, se responde solo al último). Arreglo real = cambio de función en BD (requiere OK).
- `metadata` se reescribe completa (leer-modificar-escribir): carrera posible solo con ejecuciones simultáneas del mismo número. Arreglo real = RPC con merge jsonb (BD, requiere OK).
- 3 lecturas de `wa_conversaciones` por mensaje (latencia menor; se puede unificar en una RPC).

## SEGURIDAD — CRÍTICO (encontrado 2026-10-12)
El repo `virtanancucuta/ozoagro` es **público** y `AUDITORIA.md` tenía la **service_role de Supabase VIGENTE** desde el commit `39f6d7c` (2026-08-30): da lectura/escritura total de la BD y administración de usuarios. Se retiró del archivo, pero **sigue en el historial de git** → hay que **ROTARLA** en Supabase (y actualizar la credencial n8n "OZOAGRO Supabase service_role", la credencial Postgres si aplica, y los secretos de las Edge Functions). Considerar volver el repo privado (ojo: GitHub Pages sirve la ficha PDF y la landing de respaldo).

## Ajustes 2026-10-12 (tarde)
- **Dosis = ficha técnica** (0,35–0,5 L por tanque de 200 L): prompt, ejemplo de precio, rendimiento en `Armar precios` y costo por bomba (hasta 50 ml). Probado: 3 ha × 300 L → 1,6–2,25 L; 1 ha → 0,35–1 L; bomba $6.495 con el litro.
- **Pruebas ya no envían correo al CEO**: migración `supabase/migrations/20261012_pedido_agente_es_test.sql` (APLICADA, OK de Jorge): `crear_pedido_agente` guarda `pedidos.es_test` que n8n manda en modo prueba (el valor lo fija el flujo, no el modelo); `trg_pedidos_correos` ya omitía es_test. Ensayo en transacción revertida + E2E: pedido de prueba es_test=true, 0 correos, 0 en cola de pg_net. Nota del pedido: "Ingeniero Andres (agente IA)".
- Datos de prueba borrados otra vez; `pedidos_codigo_seq` reiniciada (próximo OZO-00001).
