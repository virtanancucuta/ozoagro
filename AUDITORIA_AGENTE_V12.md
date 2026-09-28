# Auditoría Agente Andrés v12 — FOTOS del cliente (2026-09-27)

**Workflow:** `4KA11Mhc7Qs4HzDt` · "OZOAGRO WhatsApp - Agente Andres v12" · ACTIVO · 45 nodos · desplegado por API (última versión bb9b4b7a).
Base: v11 (`AUDITORIA_AGENTE_V11.md`). Pedido de Jorge: que cuando el cliente mande una foto, el agente la analice y dé un diagnóstico enfocado en la venta, **siempre** diciendo que con fotos no se puede estar seguro, que es su patrimonio y su cosecha y que recomendamos un técnico o estudio especializado, y de ahí conectar con que OZOAGRO protege y además nutre.

## Antes (verificado)
Las fotos no se miraban: `Extraer mensaje` convertía cualquier tipo distinto de texto/audio en "Mensaje tipo image, pídele que escriba o envíe audio". No había nodo de visión.

## Qué cambió
| Nodo | Cambio |
|---|---|
| Extraer mensaje | `type === 'image'` → `es_imagen`, `imagen_id`, `caption`. En modo test acepta `image.link` (URL pública) **solo si `es_test`**; en mensajes reales se ignora. |
| Es imagen? (nuevo) | Rama de la salida "no es audio". |
| Imagen de prueba? (nuevo) | Con `imagen_url_test` → `Descargar imagen prueba` (sin token de Meta, con User-Agent). Sin él → `Obtener URL imagen` (Graph API con `imagen_id`, token Meta) → `Descargar imagen` (binario). Clones de los nodos de audio que ya funcionan. |
| Imagen a base64 (nuevo) | `this.helpers.getBinaryDataBuffer` → base64 + mime. |
| Analizar imagen (nuevo) | HTTP a `chat/completions` con credencial "AIMMA OpenAI", `gpt-4.1-mini`, temperatura 0.2, prompt de agrónomo que **solo describe** (planta, parte, síntomas, insectos, estado; si no es planta lo dice; sin diagnóstico ni producto). `onError: continue`. |
| Unir texto | Si `es_imagen`: texto = `(foto enviada por el cliente. Lo que se ve en la foto: …)` + lo que escribió junto a la foto. Si la visión falla → `(foto … que no se pudo analizar …)`. Ese texto queda en Chats IA (el CEO ve qué vio el agente). |
| Prompt | Sección **SI EL CLIENTE MANDA UNA FOTO** (6 reglas): comentar con prudencia lo que PARECE; siempre las tres ideas (no se puede estar seguro / patrimonio y cosecha / técnico o estudio especializado); conectar con OZOAGRO protege + NUTRE (clorofila, raíces, suelo, sin residuos ni carencia); si ya dijo hectáreas → recomendar presentación con precio en el mismo mensaje (ejemplo incluido); nunca prometer que cura; foto borrosa → pedir otra; foto que no es planta → comentar y retomar; máximo 5 líneas, una pregunta. |
| Memoria | `sessionKey` `_v12_20260927`. |

## Pruebas con fotos reales (Wikimedia Commons, modo test, nada sale a Meta)
| Foto | Lo que vio la visión | Respuesta de Andrés (resumen) | OK |
|---|---|---|---|
| Hoja de café con roya (Hemileia vastatrix) + "tengo 3 ha en Pitalito" | Manchas naranja pulverulentas en el envés | "parece un hongo… con fotos no se puede estar seguro, es su patrimonio y su cosecha… un técnico que lo confirme… OZOAGRO protege… y nutre… Para sus 3 hectáreas le recomiendo el galón: $409.900, $102.475/L, ahorra $109.700. ¿Se lo despacho?" | ✔ |
| Tomate con tizón tardío + "mire mi tomate" | Hojas marchitas, bordes negros, enrolladas | Daño serio en hojas, prudencia + técnico, OZOAGRO protege y mejora la planta, pregunta hectáreas | ✔ |
| Mosca blanca adulta (sin texto) | Insecto blanco pequeño sobre hoja vellosa | "parece una mosca blanca… OZOAGRO repele mosca blanca…", prudencia + técnico, pregunta cultivo/hectáreas | ✔ |
| Invernadero de tomate con follaje muy dañado + "sirve ozoagro?" | Cultivo con defoliación y necrosis, frutos maduros | Honesto (follaje muy afectado, estrés o enfermedad), técnico, OZOAGRO protege y nutre (fotosíntesis, raíces), pregunta hectáreas | ✔ |
| Recibo de supermercado (no es planta) | Recibo impreso en neerlandés | "Le vi la foto del recibo… ¿en qué le ayudo con OZOAGRO? ¿Qué cultiva?" | ✔ |

Iteración: en la 1ª y 2ª corrida con la roya el agente volvía a preguntar las hectáreas que el cliente ya había dicho; se reforzó la regla con un ejemplo y en la 3ª corrida recomendó el galón con precio en el mismo mensaje. Unitarias Node 19/19 (`scripts/test_agente_v12_nodes.cjs`). Limpieza: conversaciones/historial de los números 5730000002xx borrados; BD final = 2 conversaciones reales, 0 pedidos, 0 clientes.

## Lo que NO se probó
El camino real Meta → `Obtener URL imagen` → `Descargar imagen` (con token) no se puede disparar desde fuera: son clones exactos de los nodos de audio que ya funcionan en producción, con `imagen_id` en vez de `audio_id`. **Verificación final sugerida:** Jorge manda una foto real desde su WhatsApp al bot (573133623071) y revisa en Chats IA que el mensaje del cliente empiece por "(foto enviada por el cliente…)".

## Costo
Cada foto = una llamada de visión con `gpt-4.1-mini` (unos 300 tokens de salida, imagen en detalle automático). Marginal frente al chat.
