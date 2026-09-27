# -*- coding: utf-8 -*-
"""Construye el agente Andres v11 a partir del JSON vivo (ozo_live.json) y lo sube a n8n (o --dry)."""
import json, sys, os, uuid, copy, urllib.request

S = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.join(S, 'ozo_live.json')
OUT = os.path.join(S, 'ozo_v11.json')
N8N = 'https://dvisualproyect-n8n.pgnm3b.easypanel.host'
WF = '4KA11Mhc7Qs4HzDt'
KEY = os.environ.get('N8N_API_KEY', '')  # exportar antes de correr
SB_CRED = {'supabaseApi': {'id': 'LCGbR0bTrhslOHDy', 'name': 'OZOAGRO Supabase service_role'}}
SB_URL = 'https://vlcxeajnucdkwamcivgy.supabase.co'

w = json.load(open(LIVE, encoding='utf-8'))
N = {n['name']: n for n in w['nodes']}

# ---------- 1. Prompt v11 ----------
prompt = open(os.path.join(S, 'prompt_v11.md'), encoding='utf-8').read()
assert prompt.startswith('=# QUI'), 'el prompt debe empezar con = (modo expresion)'
N['Agente OZOAGRO']['parameters']['options']['systemMessage'] = prompt

# ---------- 2. Precios actuales: + precio_mayorista (service_role; el costo NO se pide) ----------
N['Precios actuales']['parameters']['url'] = SB_URL + '/rest/v1/productos?select=nombre,litros,precio_venta,precio_mayorista&activo=eq.true&order=litros'

# ---------- 3. Armar precios: bloque distribuidor ----------
ap = N['Armar precios']['parameters']['jsCode']
old_loop = """for (const it of $input.all()) {
  const p = it.json || {};
  if (Number(p.litros) > 0 && Number(p.precio_venta) > 0) P[Number(p.litros)] = Number(p.precio_venta);
}"""
new_loop = """const M = {}; // precio mayorista fijado por el CEO (NULL = no fijado)
for (const it of $input.all()) {
  const p = it.json || {};
  if (Number(p.litros) > 0 && Number(p.precio_venta) > 0) P[Number(p.litros)] = Number(p.precio_venta);
  if (Number(p.litros) > 0 && Number(p.precio_mayorista) > 0 && Number(p.precio_mayorista) < Number(p.precio_venta)) M[Number(p.litros)] = Number(p.precio_mayorista);
}"""
assert old_loop in ap, 'no encontre el loop de precios'
ap = ap.replace(old_loop, new_loop)
old_ret = "return [{ json: { fuente, precios: P, bloque, combinaciones, bomba, objecion, cierre }, pairedItem: { item: 0 } }];"
new_ret = """// 2026-09-27 v11: precio mayorista para quien quiere ser distribuidor (solo lo fijado en Inventario; lo demas lo confirma el equipo)
const LM = Object.keys(M).map(Number).sort((a, b) => a - b);
const sinM = L.filter(l => !M[l]);
let distribuidor;
if (LM.length) {
  distribuidor = 'PRECIO MAYORISTA vigente: ' + LM.map(l => corto(l) + ' le queda al distribuidor en ' + $$(M[l]) + ' y lo vende al publico en ' + $$(P[l]) + ' (gana ' + $$(P[l] - M[l]) + (l > 1 ? ' por ' + corto(l) : ' por litro') + ')').join('; ') + '.'
    + (sinM.length ? ' El precio mayorista ' + sinM.map(l => corto(l).replace(/^el /, 'del ')).join(', ') + ' se lo confirma el equipo de OZOAGRO.' : '');
} else {
  distribuidor = 'El precio mayorista exacto se lo confirma el equipo de OZOAGRO cuando lo llamen (no des cifras).';
}
return [{ json: { fuente, precios: P, mayorista: M, bloque, combinaciones, bomba, objecion, cierre, distribuidor }, pairedItem: { item: 0 } }];"""
assert old_ret in ap, 'no encontre el return de Armar precios'
ap = ap.replace(old_ret, new_ret)
N['Armar precios']['parameters']['jsCode'] = ap

# ---------- 4. Unir texto: filtro de alucinaciones de Whisper ----------
N['Unir texto']['parameters']['jsCode'] = """const orig = $('Extraer mensaje').item.json;
let transcripcion = '';
try { transcripcion = $input.first().json.text || ''; } catch (e) {}
let texto = (transcripcion || orig.texto || '').trim();
// 2026-09-27 v11: Whisper devuelve frases inventadas cuando el audio esta vacio o con ruido (caso real: "Subtitulos realizados por la comunidad de Amara.org")
const ALUCINACION = /amara\\.org|subt[ií]tulos? (realizados|por|hechos)|gracias por ver|suscr[ií]b(e|a)te|www\\.|traducido por|^\\W*$/i;
let audio_no_entendido = false;
if (orig.es_audio && (!texto || ALUCINACION.test(texto))) { texto = '(nota de voz que no se entendio: pidale que la repita o que escriba)'; audio_no_entendido = true; }
return [{ json: { ...orig, texto, fue_audio: !!orig.es_audio, audio_no_entendido } }];"""

# ---------- 5. Parsear respuesta: tag INTERES_DISTRIBUIDOR ----------
pr = N['Parsear respuesta']['parameters']['jsCode']
old_clean = """// Limpiar TODOS los tags del texto que ve el cliente
let respuesta = raw
  .replace(/\\[ENVIAR_[A-Z_]+\\]/g, '')
  .replace(/\\[DATO_[A-Z]+:[^\\]]*\\]/g, '')
  .replace(/\\[CREAR_PEDIDO:[^\\]]*\\]/g, '')"""
assert old_clean in pr, 'no encontre el bloque de limpieza'
new_clean = """// Interes en ser distribuidor (v11)
let interes = null;
const iIni = raw.indexOf('[INTERES_DISTRIBUIDOR:');
if (iIni !== -1) {
  const iFin = raw.indexOf(']', iIni);
  if (iFin !== -1) {
    try { interes = JSON.parse(raw.substring(iIni + 22, iFin)); }
    catch (e) { interes = { parse_error: true, raw: raw.substring(iIni + 22, iFin) }; }
  }
}

// Limpiar TODOS los tags del texto que ve el cliente
let respuesta = raw
  .replace(/\\[ENVIAR_[A-Z_]+\\]/g, '')
  .replace(/\\[DATO_[A-Z]+:[^\\]]*\\]/g, '')
  .replace(/\\[CREAR_PEDIDO:[^\\]]*\\]/g, '')
  .replace(/\\[INTERES_DISTRIBUIDOR:[^\\]]*\\]/g, '')"""
pr = pr.replace(old_clean, new_clean)
old_out = "return [{ json: { from, respuesta, media, datos, tiene_datos: Object.keys(datos).length > 0, pedido, tiene_pedido: !!pedido, fallback } }];"
assert old_out in pr
pr = pr.replace(old_out, "return [{ json: { from, respuesta, media, datos, tiene_datos: Object.keys(datos).length > 0, pedido, tiene_pedido: !!pedido, interes, tiene_interes: !!interes, fallback } }];")
N['Parsear respuesta']['parameters']['jsCode'] = pr

# ---------- 6. Preparar media: archivos en la landing (restaurados en el repo) ----------
pm = N['Preparar media']['parameters']['jsCode']
assert "https://ozoagro-ozoagro.pgnm3b.easypanel.host/media/" in pm
N['Preparar media']['parameters']['jsCode'] = pm.replace("https://ozoagro-ozoagro.pgnm3b.easypanel.host/media/", "https://ozoagro.co/media/")

# ---------- 7. Memoria: sesion nueva para el prompt nuevo ----------
N['Memoria Conversacion']['parameters']['sessionKey'] = '={{ $("Extraer mensaje").item.json.from }}_v11_20260927'

# ---------- 8. Nodos nuevos: interes distribuidor -> wa_conversaciones.metadata ----------
def nid(): return str(uuid.uuid4())
if_node = copy.deepcopy(N['Hay datos lead?'])
if_node.update({'id': nid(), 'name': 'Hay interes distribuidor?', 'position': [2640, 1240]})
if_node['parameters']['conditions']['conditions'] = [{'id': 'c-interes', 'leftValue': '={{ $json.tiene_interes }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}]

get_node = {
  'parameters': {
    'url': "=" + SB_URL + "/rest/v1/wa_conversaciones?telefono=eq.{{ $('Parsear respuesta').item.json.from }}&select=id,metadata",
    'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi', 'options': {}
  },
  'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [2860, 1240], 'id': nid(), 'name': 'Leer conversacion',
  'credentials': SB_CRED, 'onError': 'continueRegularOutput', 'alwaysOutputData': True
}
merge_node = {
  'parameters': {'jsCode': """// Fusiona el interes de ser distribuidor en wa_conversaciones.metadata (sin migracion de BD)
const p = $('Parsear respuesta').item.json;
const rows = $input.all().map(i => i.json).filter(j => j && j.id);
const prev = (rows[0] && rows[0].metadata && typeof rows[0].metadata === 'object') ? rows[0].metadata : {};
const ant = prev.interes_distribuidor || {};
const nuevo = Object.assign({}, ant);
const src = (p.interes && !p.interes.parse_error) ? p.interes : {};
for (const [k, v] of Object.entries(src)) { if (v !== null && v !== undefined && String(v).trim() !== '') nuevo[k] = String(v).trim(); }
if (p.interes && p.interes.parse_error) nuevo.raw = p.interes.raw;
nuevo.telefono = nuevo.telefono || p.from;
nuevo.primera_vez = ant.primera_vez || new Date().toISOString();
nuevo.actualizado = new Date().toISOString();
nuevo.veces = (Number(ant.veces) || 0) + 1;
nuevo.estado = ant.estado || 'nuevo';
nuevo.origen = 'agente_andres';
return [{ json: { from: p.from, existe: rows.length > 0, metadata: Object.assign({}, prev, { interes_distribuidor: nuevo }) } }];"""},
  'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [3080, 1240], 'id': nid(), 'name': 'Fusionar interes'
}
patch_node = {
  'parameters': {
    'method': 'PATCH',
    'url': "=" + SB_URL + "/rest/v1/wa_conversaciones?telefono=eq.{{ $json.from }}",
    'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi',
    'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Content-Type', 'value': 'application/json'}, {'name': 'Prefer', 'value': 'return=representation'}]},
    'sendBody': True, 'specifyBody': 'json',
    'jsonBody': "={{ JSON.stringify({ metadata: $json.metadata, updated_at: new Date().toISOString() }) }}",
    'options': {}
  },
  'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [3300, 1240], 'id': nid(), 'name': 'Guardar interes distribuidor',
  'credentials': SB_CRED, 'onError': 'continueRegularOutput', 'retryOnFail': True
}
for n in (if_node, get_node, merge_node, patch_node):
    assert n['name'] not in N, n['name']
    w['nodes'].append(n)
C = w['connections']
C['Parsear respuesta']['main'][0].append({'node': 'Hay interes distribuidor?', 'type': 'main', 'index': 0})
C['Hay interes distribuidor?'] = {'main': [[{'node': 'Leer conversacion', 'type': 'main', 'index': 0}], []]}
C['Leer conversacion'] = {'main': [[{'node': 'Fusionar interes', 'type': 'main', 'index': 0}]]}
C['Fusionar interes'] = {'main': [[{'node': 'Guardar interes distribuidor', 'type': 'main', 'index': 0}]]}

# ---------- 9. Nombre ----------
w['name'] = 'OZOAGRO WhatsApp - Agente Andres v11'

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('nodos:', len(w['nodes']), '| prompt:', len(prompt), 'chars | salida:', OUT)

if '--dry' in sys.argv:
    print('DRY: no se sube'); sys.exit(0)
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT',
                             headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r:
    res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
