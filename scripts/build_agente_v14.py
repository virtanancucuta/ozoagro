# -*- coding: utf-8 -*-
"""Agente Andres v14 (2026-10-12) = v13 + manual del CEO:
- Prompt nuevo (n8n/PROMPT_ANDRES_V14.md): saludo del Ingeniero Andres, diagnostico progresivo, lenguaje prudente
  (hongos/bacterias/virus/insectos/abejas), dosis 1 L por tanque de 200 L, mezclas, competencia, objeciones del manual.
- Ficha tecnica en PDF: el agente pregunta antes; tag [ENVIAR_FICHA]; candado en el flujo (solo si la ofrecio en el
  mensaje anterior o el cliente la pidio).
- Redes sociales al cierre: tag [ENVIAR_REDES] o pedido registrado; una sola vez por conversacion
  (wa_conversaciones.metadata.redes_enviadas / ficha_enviada; el nodo 'Estado conversacion' se las muestra al agente).
- Envios extra (foto, video, ficha, redes) en un solo camino ordenado: reemplaza 'Hay media?' + 'Preparar media'.
Uso: python build_agente_v14.py <flujo v13> [--modelo=gpt-4.1 (defecto)] [--dry]
  El flujo v13 base es n8n/OZOAGRO_WHATSAPP.json del commit f26317a (git show f26317a:n8n/OZOAGRO_WHATSAPP.json > base.json).
  En produccion corre con --modelo=gpt-4.1 (con gpt-4.1-mini el precio pedido con hectareas se aplazaba en 2 de 3 pruebas).   (N8N_API_KEY en el entorno para el PUT)"""
import json, sys, os, urllib.request
S = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(S)
LIVE = sys.argv[1]; OUT = os.path.join(S, 'ozo_v14.json')
N8N = 'https://dvisualproyect-n8n.pgnm3b.easypanel.host'; WF = '4KA11Mhc7Qs4HzDt'
KEY = os.environ.get('N8N_API_KEY', '')
w = json.load(open(LIVE, encoding='utf-8')); N = {n['name']: n for n in w['nodes']}
assert w['name'].endswith('v13'), 'se esperaba el flujo v13 vivo: ' + w['name']
SUPA = 'https://vlcxeajnucdkwamcivgy.supabase.co'
CRED_SUPA = N['Leer conversacion']['credentials']
CRED_META = N['Enviar media']['credentials']
FICHA_URL = 'https://virtanancucuta.github.io/ozoagro/landing/media/ficha_tecnica_ozoagro.pdf'
REDES = ("Nos puede seguir en nuestras redes para que nos conozca más y vea nuestro trabajo a fondo 🌱\n\n"
         "Página web\nhttps://ozoagrolatam.com\n\n"
         "Facebook\nhttps://www.facebook.com/latamozoagro\n\n"
         "Instagram\nhttps://www.instagram.com/ozoagro\n\n"
         "TikTok\nhttps://www.tiktok.com/@ozoagrolatam")

# ---------- 1. Prompt ----------
sm = open(os.path.join(R, 'n8n', 'PROMPT_ANDRES_V14.md'), encoding='utf-8').read().strip() + '\n'
for marca in ["$('Armar precios').first().json.bloque", "json.combinaciones", "json.bomba", "json.objecion", "json.cierre",
              "json.distribuidor", "SALUDO CORRECTO PARA LA HORA", "[ENVIAR_FICHA]", "[ENVIAR_REDES]", "[CREAR_PEDIDO:"]:
    assert marca in sm, 'falta en el prompt: ' + marca
N['Agente OZOAGRO']['parameters']['options']['systemMessage'] = '=' + sm

# ---------- 2. Armar precios: rendimiento por tanques de 200 L (ya no "= N hectareas") ----------
js = N['Armar precios']['parameters']['jsCode']
old = "s += '. Rinde ' + $$(l * 200).slice(1) + ' litros de mezcla = ' + l + (l === 1 ? ' hectárea' : ' hectáreas') + ' por aplicación.';"
new = "s += '. Alcanza para ' + l + (l === 1 ? ' tanque' : ' tanques') + ' de 200 litros de agua (' + $$(l * 200).slice(1) + ' litros de mezcla).';"
assert old in js, 'Armar precios cambio'
N['Armar precios']['parameters']['jsCode'] = js.replace(old, new)

# ---------- 3. Parsear respuesta: tags nuevos ----------
js = N['Parsear respuesta']['parameters']['jsCode']
old = "// Datos del lead"
new = ("// v14: ficha tecnica en PDF y redes sociales al cierre\n"
       "const ficha = raw.includes('[ENVIAR_FICHA]');\n"
       "const redes = raw.includes('[ENVIAR_REDES]');\n\n// Datos del lead")
assert old in js; js = js.replace(old, new, 1)
old = "fallback } }];"
new = "fallback, ficha, redes } }];"
assert old in js; js = js.replace(old, new, 1)
# el mapa de media ya no debe capturar ENVIAR_FICHA/ENVIAR_REDES (no estan en mediaMap) y el replace general /\[ENVIAR_[A-Z_]+\]/ los limpia
N['Parsear respuesta']['parameters']['jsCode'] = js

# ---------- 4. Envios extra en un solo camino ----------
for viejo in ['Hay media?', 'Preparar media']:
    w['nodes'] = [n for n in w['nodes'] if n['name'] != viejo]
    w['connections'].pop(viejo, None)
N = {n['name']: n for n in w['nodes']}
x0, y0 = N['Registrar saliente']['position']

leer = {
    'parameters': {
        'url': "=" + SUPA + "/rest/v1/wa_conversaciones?telefono=eq.{{ $('Parsear respuesta').item.json.from }}"
               "&select=id,metadata,wa_mensajes(rol,contenido,created_at)&wa_mensajes.order=created_at.desc&wa_mensajes.limit=15",
        'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi', 'options': {}},
    'name': 'Leer contexto envios', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2,
    'position': [x0 + 208, y0], 'credentials': CRED_SUPA, 'onError': 'continueRegularOutput', 'alwaysOutputData': True}

preparar_js = r"""// v14 (2026-10-12): mensajes extra despues de la respuesta, EN ORDEN: foto/video del producto, ficha tecnica PDF, redes.
// Candados deterministas (no dependen solo del prompt):
//  - ficha: solo si el agente la OFRECIO en su mensaje anterior o el cliente la PIDIO en lo que acaba de escribir.
//  - redes: una sola vez por conversacion (metadata.redes_enviadas); salen con [ENVIAR_REDES] o con un pedido bien formado.
//  - si no se pudo leer la conversacion: NO salen ficha ni redes (fallar cerrado: sin estado no hay candado ni marca segura).
// Cada item lleva la 'marca' que se guarda en metadata SOLO si el envio sale bien ('Confirmar envios' + 'Unir marcas').
const p = $('Parsear respuesta').item.json;
const ex = $('Extraer mensaje').item.json;
const conv = ($input.all().map(i => i.json).find(j => j && j.id)) || null;
const msgs = (conv && Array.isArray(conv.wa_mensajes)) ? conv.wa_mensajes : []; // mas reciente primero
const BASE = 'https://ozoagro.co/media/';
const FICHA_URL = '__FICHA_URL__';
const REDES = __REDES__;
const MEDIA = {
  imagen: { type: 'image', url: BASE + 'producto.jpg', registro: '[Foto del producto enviada]' },
  video_pepino: { type: 'video', url: BASE + 'video_pepino.mp4', registro: '[Video de resultados en pepino enviado]' },
  video_papaya: { type: 'video', url: BASE + 'video_papaya.mp4', registro: '[Video de resultados en papaya enviado]' },
  video_sandia: { type: 'video', url: BASE + 'video_sandia.mp4', registro: '[Video de resultados en sandía enviado]' }
};
// filas que registran envios extra ("[Ficha ... enviada]", "[Video ...]", el texto de redes): no son mensajes del agente
const esRegistro = (c) => { const s = String(c || '').trim(); return (s.startsWith('[') && s.endsWith(']')) || s === REDES; };
const out = [];
const item = (tipo, payload, registro, marca) => out.push({ json: { tipo, from: p.from, es_test: !!ex.es_test, payload, registro, marca: marca || null } });

const m = MEDIA[p.media];
if (m) item(p.media, { type: m.type, [m.type]: { link: m.url } }, m.registro);

if (conv) {
  const meta = (conv.metadata && typeof conv.metadata === 'object') ? conv.metadata : {};
  if (p.ficha) {
    // primera fila real del agente = respuesta actual (ya registrada); la anterior = siguiente 'assistant' que no sea registro
    let vistos = 0, previoAgente = '', delCliente = '';
    for (const r of msgs) {
      if (r.rol === 'assistant') { if (esRegistro(r.contenido)) continue; vistos++; if (vistos === 2) { previoAgente = String(r.contenido || ''); break; } }
      else if (r.rol === 'user' && vistos === 1) delCliente += ' ' + String(r.contenido || '');
    }
    if (/ficha/i.test(previoAgente) || /(ficha|pdf)/i.test(delCliente))
      item('ficha', { type: 'document', document: { link: FICHA_URL, filename: 'Ficha técnica OZOAGRO.pdf' } }, '[Ficha técnica OZOAGRO enviada en PDF]', 'ficha_enviada');
  }
  const pedidoOk = !!(p.tiene_pedido && p.pedido && !p.pedido.parse_error);
  if ((p.redes || pedidoOk) && !meta.redes_enviadas)
    item('redes', { type: 'text', text: { body: REDES, preview_url: false } }, REDES, 'redes_enviadas');
}
return out;"""
preparar_js = preparar_js.replace('__FICHA_URL__', FICHA_URL).replace('__REDES__', json.dumps(REDES, ensure_ascii=False))
preparar = {'parameters': {'jsCode': preparar_js}, 'name': 'Preparar envios', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
            'position': [x0 + 416, y0]}

envio_real = {'parameters': {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose'},
    'conditions': [{'id': 'c-envio-real', 'leftValue': '={{ $json.es_test }}', 'rightValue': '',
                    'operator': {'type': 'boolean', 'operation': 'false', 'singleValue': True}}], 'combinator': 'and'}, 'options': {}},
    'name': 'Envio real?', 'type': 'n8n-nodes-base.if', 'typeVersion': 2.2, 'position': [x0 + 624, y0 - 96]}

em = N['Enviar media']
em['parameters']['jsonBody'] = ("={{ (function(){ const f = $json.from; const p = Object.assign({ messaging_product: 'whatsapp', recipient_type: 'individual' }, $json.payload); "
                                "if (/^[A-Z]{2}\\./.test(f)) { p.recipient = f; } else { p.to = f; } return JSON.stringify(p); })() }}")
# uno por uno con pausa: WhatsApp entrega en el orden en que llegan (foto/video -> ficha -> redes)
em['parameters']['options'] = {'batching': {'batch': {'batchSize': 1, 'batchInterval': 2500}}}
em['onError'] = 'continueErrorOutput'  # salida 0 = enviado; salida 1 = Meta lo rechazo (no se registra ni se marca)
em['position'] = [x0 + 832, y0 - 96]

registrar = {'parameters': {
    'method': 'POST', 'url': SUPA + '/rest/v1/rpc/registrar_mensaje_saliente',
    'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi',
    'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Content-Type', 'value': 'application/json'}]},
    'sendBody': True, 'specifyBody': 'json',
    'jsonBody': "={{ JSON.stringify({ p_telefono: $json.from, p_contenido: $json.registro }) }}",
    'options': {'response': {'response': {'responseFormat': 'text'}}}},
    'name': 'Registrar envios', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [x0 + 624, y0 + 96],
    'credentials': CRED_SUPA, 'onError': 'continueRegularOutput'}

confirmar_js = r"""// Normaliza lo que SI salio: desde 'Enviar media' (salida OK) en real, o directo desde 'Envio real?' en modo test.
return $input.all().map((it, i) => { const s = $('Preparar envios').itemMatching(i).json; return { json: { from: s.from, tipo: s.tipo, registro: s.registro, marca: s.marca } }; });"""
confirmar = {'parameters': {'jsCode': confirmar_js}, 'name': 'Confirmar envios', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
             'position': [x0 + 1040, y0]}
unir_js = r"""// Una sola escritura por ejecucion: metadata leida en 'Leer contexto envios' + marcas de lo enviado con exito.
const marcas = $input.all().map(i => i.json.marca).filter(Boolean);
if (!marcas.length) return [];
const conv = ($('Leer contexto envios').all().map(i => i.json).find(j => j && j.id)) || null;
if (!conv) return [];
const meta = Object.assign({}, (conv.metadata && typeof conv.metadata === 'object') ? conv.metadata : {});
const ahora = new Date().toISOString();
for (const k of marcas) meta[k] = ahora;
return [{ json: { from: $input.first().json.from, metadata: meta } }];"""
unir = {'parameters': {'jsCode': unir_js}, 'name': 'Unir marcas', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
        'position': [x0 + 1248, y0 + 192]}

marcar = {'parameters': {
    'method': 'PATCH', 'url': "=" + SUPA + "/rest/v1/wa_conversaciones?telefono=eq.{{ $json.from }}",
    'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi',
    'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Content-Type', 'value': 'application/json'}, {'name': 'Prefer', 'value': 'return=minimal'}]},
    'sendBody': True, 'specifyBody': 'json',
    'jsonBody': "={{ JSON.stringify({ metadata: $json.metadata, updated_at: new Date().toISOString() }) }}",
    'options': {}},
    'name': 'Marcar envios', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [x0 + 1456, y0 + 192],
    'credentials': CRED_SUPA, 'onError': 'continueRegularOutput'}
registrar['position'] = [x0 + 1248, y0 - 96]

ax, ay = N['Armar precios']['position']
estado = {'parameters': {'url': "=" + SUPA + "/rest/v1/wa_conversaciones?telefono=eq.{{ $('Extraer mensaje').item.json.from }}&select=metadata",
          'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi', 'options': {}},
          'name': 'Estado conversacion', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [ax + 104, ay + 160],
          'credentials': CRED_SUPA, 'onError': 'continueRegularOutput', 'alwaysOutputData': True}
w['nodes'] += [leer, preparar, envio_real, registrar, confirmar, unir, marcar, estado]
C = w['connections']
C['Armar precios'] = {'main': [[{'node': 'Estado conversacion', 'type': 'main', 'index': 0}]]}
C['Estado conversacion'] = {'main': [[{'node': 'Agente OZOAGRO', 'type': 'main', 'index': 0}]]}
C['Registrar saliente'] = {'main': [[{'node': 'Leer contexto envios', 'type': 'main', 'index': 0}]]}
C['Leer contexto envios'] = {'main': [[{'node': 'Preparar envios', 'type': 'main', 'index': 0}]]}
C['Preparar envios'] = {'main': [[{'node': 'Envio real?', 'type': 'main', 'index': 0}]]}
C['Envio real?'] = {'main': [[{'node': 'Enviar media', 'type': 'main', 'index': 0}], [{'node': 'Confirmar envios', 'type': 'main', 'index': 0}]]}
C['Enviar media'] = {'main': [[{'node': 'Confirmar envios', 'type': 'main', 'index': 0}], []]}
C['Confirmar envios'] = {'main': [[{'node': 'Registrar envios', 'type': 'main', 'index': 0}, {'node': 'Unir marcas', 'type': 'main', 'index': 0}]]}
C['Unir marcas'] = {'main': [[{'node': 'Marcar envios', 'type': 'main', 'index': 0}]]}

# ---------- 4b. Temperatura 0.6 -> 0.4 (mas consistente con las reglas de oro) ----------
assert N['OpenAI Chat Model']['parameters']['options'].get('temperature') == 0.6
N['OpenAI Chat Model']['parameters']['options']['temperature'] = 0.4
MODELO = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--modelo=')), 'gpt-4.1')
N['OpenAI Chat Model']['parameters']['model'] = {'__rl': True, 'value': MODELO, 'mode': 'list', 'cachedResultName': MODELO}

# ---------- 4c. Seguridad: el link de imagen de prueba solo puede ser de Wikimedia (evita SSRF por el webhook publico) ----------
js = N['Extraer mensaje']['parameters']['jsCode']
old = "if (es_test) imagen_url_test = String((msg.image || {}).link || ''); // solo pruebas: URL publica en vez de Meta"
new = ("if (es_test) { // solo pruebas: URL publica en vez de Meta, y SOLO de Wikimedia por https (el webhook es publico: nada de URLs arbitrarias)\n"
       "      const lk = String((msg.image || {}).link || '');\n"
       r"      if (/^https:\/\/(upload|thumb|commons)\.wikimedia\.org\/[^\s]*$/.test(lk)) imagen_url_test = lk; // regex: el sandbox de n8n no trae URL()" "\n"
       "      if (!imagen_url_test) { es_imagen = false; imagen_id = ''; caption = '(foto enviada por el cliente que no se pudo analizar)' + (caption ? ' ' + caption : ''); }\n"
       "    }")
assert old in js, 'Extraer mensaje cambio'
N['Extraer mensaje']['parameters']['jsCode'] = js.replace(old, new)
print('imagen prueba IF:', json.dumps(N['Imagen de prueba?']['parameters']['conditions']['conditions'])[:300])

# ---------- 5. Memoria nueva (el saludo nuevo aplica tambien a quien ya habia escrito) ----------
N = {n['name']: n for n in w['nodes']}
N['Memoria Conversacion']['parameters']['sessionKey'] = '={{ $("Extraer mensaje").item.json.from }}_v14_20261012'
w['name'] = 'OZOAGRO WhatsApp - Agente Andres v14'

# ---------- chequeos ----------
nombres = {n['name'] for n in w['nodes']}
for src, v in C.items():
    assert src in nombres, 'conexion desde nodo inexistente: ' + src
    for outs in v.values():
        for o in outs:
            for t in o: assert t['node'] in nombres, 'conexion a nodo inexistente: ' + t['node']
txt = json.dumps(w, ensure_ascii=False)
for viejo in ["$('Hay media?')", "$('Preparar media')"]:
    assert viejo not in txt, 'quedo referencia vieja: ' + viejo

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('nodos:', len(w['nodes']), '| prompt:', len(sm), 'chars | ->', OUT)
if '--dry' in sys.argv: print('DRY'); sys.exit(0)
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT',
                             headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r: res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
