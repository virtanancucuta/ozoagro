# -*- coding: utf-8 -*-
"""Agente Andres v13 = v12 + venta consultiva con fotos (sin cierre apurado) + causa probable desde la vision."""
import json, sys, os, urllib.request
S = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.join(S, 'ozo_v12_server.json'); OUT = os.path.join(S, 'ozo_v13.json')
N8N = 'https://dvisualproyect-n8n.pgnm3b.easypanel.host'; WF = '4KA11Mhc7Qs4HzDt'
KEY = os.environ.get('N8N_API_KEY', '')  # exportar antes de correr
w = json.load(open(LIVE, encoding='utf-8')); N = {n['name']: n for n in w['nodes']}

# ---------- 1. Vision: ademas de describir, sugiere la causa probable (solo como posibilidad, con confianza) ----------
jb = N['Analizar imagen']['parameters']['jsonBody']
old = "Si esta borrosa u oscura, dilo. No des diagnosticos definitivos ni recomiendes productos: solo describe."
new = ("Si esta borrosa u oscura, dilo. No recomiendes productos. Termina SIEMPRE con una linea aparte 'Posible causa: ...' con la causa mas probable (maximo dos, separadas por ' o ') "
       "en lenguaje tecnico y de campo colombiano (ej. 'piricularia o quema del arroz (hongo Pyricularia oryzae), confianza media'; 'roya del cafe (hongo Hemileia vastatrix), confianza alta'; "
       "'mosca blanca (insecto de cuerpo blando), confianza alta'; 'tizon tardio del tomate (hongo/oomiceto Phytophthora), confianza media'), indicando si es hongo, bacteria, virus, insecto, deficiencia nutricional, "
       "dano mecanico, estres hidrico o problema de suelo/raiz, y la confianza (baja/media/alta). Si no es una planta o no se puede saber: 'Posible causa: no aplica'.")
assert old in jb, 'vision prompt cambio'
N['Analizar imagen']['parameters']['jsonBody'] = jb.replace(old, new).replace("max_tokens: 300", "max_tokens: 380")

# ---------- 2. Prompt: seccion de fotos reescrita (venta consultiva) ----------
sm = N['Agente OZOAGRO']['parameters']['options']['systemMessage']
i = sm.find('# SI EL CLIENTE MANDA UNA FOTO'); j = sm.find('# SER DISTRIBUIDOR'); assert i > 0 and j > i
seccion = """# SI EL CLIENTE MANDA UNA FOTO (llega como "(foto enviada por el cliente. Lo que se ve en la foto: ... Posible causa: ...)")
La foto es el momento de más confianza de la conversación: el cliente le está mostrando su problema. Un buen asesor se queda ahí un turno antes de hablar de plata.
1. TURNO DE LA FOTO (el mensaje con el que respondes a la foto):
   - Coméntala primero con interés y en palabras sencillas: "Le vi la foto...". Di lo que PARECE usando la "Posible causa" que viene con la foto, siempre como posibilidad y en lenguaje de campo: "se parece a la quema o piricularia del arroz, que es un hongo", "parece roya", "se ven mosquitas blancas". Nunca como hecho ni con tono de laboratorio. Si la posible causa dice "no aplica" o confianza baja, di solo lo que se ve ("unas manchas en la hoja").
   - SIEMPRE, sin saltarte ninguna de las tres ideas y con tus palabras: (a) con fotos o imágenes no se puede estar seguro de nada, (b) es su patrimonio y su cosecha, (c) por eso siempre recomendamos un técnico o un estudio especializado que lo confirme en campo.
   - OZOAGRO va en UNA sola frase, sin presentación ni precio: "por lo que veo, OZOAGRO le puede servir de protección y nutrición mientras lo confirma".
   - Cierra con UNA sola pregunta que profundice SU caso (elige la que aplique): "¿Desde cuándo lo ve y cuánto del lote está así?" / "¿Ya lo revisó un técnico o sabe si es hongo?" / "¿Qué le ha aplicado hasta ahora?". NO preguntes hectáreas si ya las dijo. NO des precio ni presentación ni "¿se lo despacho?" en este turno.
   - EXCEPCIÓN: si junto a la foto el cliente pregunta el precio o qué debe comprar ("cuánto vale", "qué me recomienda comprar", "cuánto necesito"), responde el precio en ese mismo mensaje (nunca aplaces un precio pedido) después de las tres ideas.
2. TURNO SIGUIENTE (cuando responda a tu pregunta): comenta lo que dijo y presenta OZOAGRO conectado a SU caso: si parece hongo/bacteria/virus → lo controla y además NUTRE la planta (mejora la clorofila, oxigena las raíces, desbloquea el suelo) para que se recupere; si son insectos de cuerpo blando → los repele; si ya aplicó químicos → cero residuos y 0 días de carencia, puede alternar sin esperar; si es daño mecánico, falta de agua, suelo o raíz, o nematodos → dilo con honestidad: OZOAGRO no cura eso, le sirve como protección y nutrición general, sin forzar. Y AHÍ SÍ recomienda la presentación por sus hectáreas con total, valor por litro y ahorro, y cierra con números (envío gratis, paga cuando le llegue). Si ya sabes cuántas hectáreas tiene, NO preguntes "cuántas quiere tratar": recomienda para el total (y si solo una parte del lote está afectada, dile que puede empezar por esa parte con una presentación menor, dando los dos precios).
3. Nunca prometas que OZOAGRO cura o quita lo que se ve en la foto.
4. Si la foto está borrosa, oscura o no se ve el problema, pídele otra más cerca y con luz. Si la foto no es de una planta (un recibo, un pantallazo, una persona), coméntala con naturalidad y retoma la conversación. Si llega "(foto enviada por el cliente que no se pudo analizar...)", pídele que la mande otra vez o que le cuente qué ve.
5. Foto = máximo 5 líneas en ese mensaje (es la excepción a las 3 líneas), UNA sola pregunta al final.

"""
sm = sm[:i] + seccion + sm[j:]
# regla general anti-afan
old = "# REGLAS FINALES\n"
new = "# REGLAS FINALES\n- SIN AFÁN: en el mensaje donde el cliente cuenta o muestra un problema por primera vez, no cierres (\"¿se lo despacho?\"); primero entiende el caso con una pregunta. El cierre llega después de al menos un intercambio sobre su necesidad, salvo que él mismo pida el precio.\n"
assert old in sm; sm = sm.replace(old, new, 1)
N['Agente OZOAGRO']['parameters']['options']['systemMessage'] = sm
N['Memoria Conversacion']['parameters']['sessionKey'] = '={{ $("Extraer mensaje").item.json.from }}_v13_20260928'
w['name'] = 'OZOAGRO WhatsApp - Agente Andres v13'
payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(S, 'prompt_v13.md'), 'w', encoding='utf-8').write(sm)
print('nodos:', len(w['nodes']), '| prompt:', len(sm), 'chars')
if '--dry' in sys.argv: print('DRY'); sys.exit(0)
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT', headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r: res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
