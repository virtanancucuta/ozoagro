# Auditoría Agente Andrés v13 — fotos con venta consultiva (2026-09-28)

**Workflow:** `4KA11Mhc7Qs4HzDt` · "OZOAGRO WhatsApp - Agente Andres v13" · ACTIVO · 45 nodos (mismos que v12) · última versión a962483a.

## Por qué
Jorge mandó una foto real de arroz (00:33) y el agente v12 respondió foto → prudencia → "para sus 30 ha le recomiendo 20 unidades, $1.998.000, ¿se lo despacho?" en un solo mensaje. Cierre apurado. Causa: la regla v12 "si ya sabe las hectáreas, recomienda con precio en el mismo mensaje". El camino real Meta → descarga → visión quedó confirmado con esa foto (ejecución 40366).

## Cambios (los 4 puntos + el extra aprobados por Jorge)
1. **Turno de la foto:** comentar lo que parece + las tres ideas (no se puede estar seguro / patrimonio y cosecha / técnico o estudio especializado) + OZOAGRO en UNA frase sin precio + UNA pregunta que profundice el caso (desde cuándo, cuánto del lote, si un técnico lo vio o sabe si es hongo, qué ha aplicado). No pregunta hectáreas si ya las dijo.
2. **Turno siguiente:** presenta OZOAGRO conectado a lo que respondió (hongo → controla y nutre; insectos → repele; ya aplicó químico → sin carencia ni residuos; daño mecánico/agua/suelo/nematodos → honestidad) y ahí sí recomienda por sus hectáreas con precio, sin preguntar "cuántas quiere tratar".
3. **Excepción:** precio pedido junto a la foto → se da en el mismo mensaje.
4. **Regla general SIN AFÁN:** nunca "¿se lo despacho?" en el mensaje donde el cliente muestra un problema por primera vez.
5. **Extra:** la visión termina con "Posible causa: …" (máximo dos, tipo de causa, confianza baja/media/alta, "no aplica" si no es planta). Andrés la usa solo como "parece / se parece a", en lenguaje de campo, nunca como hecho; con confianza baja solo describe.
Memoria: `sessionKey` `_v13_20260928`.

## Pruebas (modo test, fotos reales de Commons)
| Caso | Turnos | Resultado |
|---|---|---|
| A. Arroz 30 ha (Zulia) → foto de piricularia "Si tengo este problema" → "8 días, un cuarto del lote, sin técnico, fungicida y nada" | 3 | T1 escucha y pregunta manejo. T2: "parece la quemadura del arroz, un hongo Pyricularia… con fotos no se puede estar seguro, es su patrimonio… un técnico… OZOAGRO le puede servir de protección y nutrición mientras lo confirma. ¿Desde cuándo y cuánto del lote?" T3: "si ya aplicó fungicida y no mejoró, OZOAGRO controla el hongo y nutre… Para sus 30 ha, 20 unidades $1.998.000, $99.900/L, ahorra $600.000. ¿Le despacho?" ✔ (1ª corrida preguntó "cuántas quiere tratar"; se reforzó la regla y la 2ª quedó bien) |
| B. Roya de café + "3 ha, cuánto me vale lo que necesito?" | 1 | Nombra roya como "parece", tres ideas, OZOAGRO una frase, **precio en el mismo mensaje porque lo pidió** (galón $409.900), cierra con pregunta de caso, no con "¿se lo despacho?" ✔ |
| C. Mosca blanca sin texto → "tomate, 2 ha, toda la mata, una semana" | 2 | T1: "parece mosca blanca…", tres ideas, pregunta desde cuándo. T2: repele mosca blanca + nutre, galón con precio ✔ |
| D. Recibo | 1 | Lo comenta, no vende, retoma con "¿qué cultiva usted?" ✔ |

Limpieza: conversaciones/historial de los números 5730000003xx borrados. BD final = 2 conversaciones reales (Alfredo + Jorge), 0 pedidos, 0 clientes.

## Observación
En algunas respuestas junta dos preguntas en una frase ("¿desde cuándo y cuánto del lote?"). Es natural en el habla y no bloquea; se puede endurecer si molesta.
