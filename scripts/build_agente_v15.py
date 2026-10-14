# -*- coding: utf-8 -*-
"""Agente Andres v15 (2026-10-14) = v14 + numero PROPIO de OZOAGRO en la API oficial de WhatsApp.
- Solo atiende mensajes y estados que llegan al numero de OZOAGRO (phone_number_id 1436278792892245);
  todo lo del numero de prueba de AIMMA (1151148548077223) se ignora (la app de AIMMA sigue apuntando a esta URL).
- Responde, manda media/ficha/redes y descarga audios/fotos con el token de OZOAGRO (credencial n8n por NOMBRE).
Uso: python build_agente_v15.py scripts/ozo_v14.json [--dry]   (ozo_v14.json = salida de build_agente_v14.py --dry)
     N8N_API_KEY en el entorno. La credencial "OZOAGRO Meta WhatsApp Token" (Header Auth) la crea Jorge en n8n."""
import json, sys, os, urllib.request
S = os.path.dirname(os.path.abspath(__file__))
BASE = sys.argv[1]; OUT = os.path.join(S, 'ozo_v15.json')
N8N = 'https://dvisualproyect-n8n.pgnm3b.easypanel.host'; WF = '4KA11Mhc7Qs4HzDt'
KEY = os.environ.get('N8N_API_KEY', '')
OZO_PHONE_ID = '1436278792892245'; AIMMA_PHONE_ID = '1151148548077223'
CRED_NOMBRE = 'OZOAGRO Meta WhatsApp Token'; CRED_AIMMA = 'HxFbYAP7T9Wi7vGc'
DRY = '--dry' in sys.argv

w = json.load(open(BASE, encoding='utf-8')); N = {n['name']: n for n in w['nodes']}
assert w['name'].endswith('v14'), 'se esperaba la salida del build v14: ' + w['name']

def api(path):
    req = urllib.request.Request(N8N + '/api/v1' + path, headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req) as r: return json.load(r)

# ---------- 1. Credencial de OZOAGRO (por nombre; la crea Jorge, el token nunca pasa por aqui) ----------
cred = None
if KEY:
    lista = api('/credentials?limit=250'); lista = lista.get('data', lista) if isinstance(lista, dict) else lista
    cand = [c for c in lista if c.get('name') == CRED_NOMBRE]
    assert len(cand) <= 1, 'hay mas de una credencial llamada ' + CRED_NOMBRE
    if cand:
        assert cand[0]['type'] == 'httpHeaderAuth', 'la credencial debe ser Header Auth, es ' + cand[0]['type']
        cred = {'id': cand[0]['id'], 'name': CRED_NOMBRE}
if not cred:
    assert DRY, 'falta la credencial "' + CRED_NOMBRE + '" en n8n (Header Auth: Authorization = Bearer <token permanente>)'
    cred = {'id': 'PENDIENTE', 'name': CRED_NOMBRE}

# ---------- 2. Meta: numero y token de OZOAGRO en los 6 nodos que llaman a graph.facebook.com ----------
cambiados = []
for n in w['nodes']:
    c = (n.get('credentials') or {}).get('httpHeaderAuth')
    if c and c.get('id') == CRED_AIMMA:
        n['credentials']['httpHeaderAuth'] = dict(cred); cambiados.append(n['name'])
    s = json.dumps(n['parameters'], ensure_ascii=False)
    if AIMMA_PHONE_ID in s:
        n['parameters'] = json.loads(s.replace(AIMMA_PHONE_ID, OZO_PHONE_ID))
assert sorted(cambiados) == sorted(['Obtener URL media', 'Descargar audio', 'Enviar WhatsApp', 'Enviar media', 'Obtener URL imagen', 'Descargar imagen']), cambiados

# ---------- 3. Extraer mensaje: solo lo que llega al numero de OZOAGRO ----------
def reemplazar(js, old, new, que):
    assert js.count(old) == 1, 'Extraer mensaje (' + que + ') cambio: el texto a reemplazar no aparece exactamente una vez'
    return js.replace(old, new)
js = N['Extraer mensaje']['parameters']['jsCode']
# Meta puede agrupar varios eventos en un POST: se toma el primero que sea del numero de OZOAGRO (no solo entry[0]).
# La app de prueba de AIMMA comparte esta URL: lo de su numero se ignora.
js = reemplazar(js, "  const ch = (((body.entry || [])[0] || {}).changes || [])[0] || {};\n",
    "  // v15: solo el numero propio de OZOAGRO, buscado en todos los entry/changes del POST\n"
    "  const ch = (body.entry || []).flatMap(en => (en && en.changes) || [])\n"
    "    .find(c => String((((c || {}).value || {}).metadata || {}).phone_number_id || '') === '" + OZO_PHONE_ID + "') || {};\n", 'entry')
js = reemplazar(js, "  const value = ch.value || {};\n",
    "  const value = ch.value || {};\n"
    "  if (String((value.metadata || {}).phone_number_id || '') !== '" + OZO_PHONE_ID + "') { return []; }\n", 'filtro numero')
# Remitente con formato valido: se interpola en URLs de PostgREST con service_role (ej. PATCH ?telefono=eq.X);
# un "from" falso como "1&telefono=not.is.null" haria que el PATCH tocara TODAS las conversaciones.
RE_WA = "/^(\\d{8,15}|[A-Z]{2}\\.[A-Za-z0-9]{1,64})$/"
js = reemplazar(js, "  if (!remitente) { return []; } // sin remitente no hay a quien responder\n",
    "  if (!remitente) { return []; } // sin remitente no hay a quien responder\n"
    "  if (!" + RE_WA + ".test(String(remitente))) { return []; } // formato WhatsApp valido o nada\n", 'remitente')
# estados fallidos: misma validacion que el remitente (incluye usuarios CO.xxxx)
js = reemplazar(js, "    if (st && st.status === 'failed') {\n",
    "    if (st && st.status === 'failed' && " + RE_WA + ".test(String(st.recipient_id || ''))) {\n", 'fallo')
# modo prueba: prefijo del id + numero del rango de pruebas (5730000001xx-4xx). Asi un id falso 'wamid.TEST_' con un
# numero real no puede esconder un pedido (es_test=true omite el correo al CEO). La defensa de fondo es la firma de Meta.
js = reemplazar(js, "  const es_test = String(msg.id || '').startsWith('wamid.TEST_') && String(remitente) !== '573172625415';\n",
    "  const es_test = String(msg.id || '').startsWith('wamid.TEST_') && /^573000000[1-4]\\d\\d$/.test(String(remitente));\n", 'es_test')

# ---------- 4. Media: el token de OZOAGRO solo viaja a Meta ----------
# Los ids de audio/foto van en la ruta de graph.facebook.com y la URL que devuelve se descarga CON el token:
# id solo numerico y descarga solo a lookaside.fbsbx.com (dominio real de Meta, visto en la ejecucion 42242).
js = reemplazar(js, "  else { texto = '[Mensaje tipo ' + t + '. Pidele que escriba, envie audio o una foto.]'; }\n",
    "  else { texto = '[Mensaje tipo ' + t + '. Pidele que escriba, envie audio o una foto.]'; }\n"
    "  // v15: ids de media solo numericos (van en la ruta de graph.facebook.com con el token)\n"
    "  if (es_audio && !/^\\d{5,30}$/.test(String(audio_id))) { es_audio = false; audio_id = ''; texto = '(nota de voz que no se entendió)'; }\n"
    "  if (es_imagen && !imagen_url_test && !/^\\d{5,30}$/.test(String(imagen_id))) { es_imagen = false; imagen_id = ''; texto = '(foto enviada por el cliente que no se pudo analizar)' + (caption ? ' ' + caption : ''); }\n", 'media')
N['Extraer mensaje']['parameters']['jsCode'] = js
for nodo in ['Descargar audio', 'Descargar imagen']:
    assert N[nodo]['parameters']['url'] == '={{ $json.url }}', nodo + ' cambio'
    N[nodo]['parameters']['url'] = "={{ /^https:\\/\\/lookaside\\.fbsbx\\.com\\//.test(String($json.url || '')) ? $json.url : 'https://lookaside.fbsbx.com/bloqueado-url-no-meta' }}"
# si Meta falla o la URL se bloquea, el flujo SIGUE: 'Unir texto' ya convierte transcripcion/vision vacias en
# "(nota de voz que no se entendio...)" / "(foto ... que no se pudo analizar...)" y el agente le pide al cliente repetir.
for nodo in ['Obtener URL media', 'Descargar audio', 'Transcribir audio', 'Obtener URL imagen', 'Descargar imagen', 'Imagen a base64']:
    N[nodo]['onError'] = 'continueRegularOutput'

# ---------- 5. Firma de Meta (X-Hub-Signature-256): solo se procesa lo que firmo Meta con el App Secret ----------
# El modulo crypto esta bloqueado en los nodos Code de este n8n: el HMAC lo calcula el nodo Crypto sobre el cuerpo CRUDO
# (rawBody) con la credencial "OZOAGRO Meta App Secret" (tipo crypto): la clave nunca queda en el flujo ni en el repo.
# Probado 2026-10-14 en un flujo sonda: firma correcta coincide (UTF-8 y ASCII), firma falsa no.
SEC_NOMBRE = 'OZOAGRO Meta App Secret'
sec = None
if KEY:
    lista = api('/credentials?limit=250'); lista = lista.get('data', lista) if isinstance(lista, dict) else lista
    cand = [c for c in lista if c.get('name') == SEC_NOMBRE]
    assert len(cand) <= 1, 'hay mas de una credencial llamada ' + SEC_NOMBRE
    if cand:
        assert cand[0]['type'] == 'crypto', 'la credencial del App Secret debe ser tipo crypto, es ' + cand[0]['type']
        sec = {'id': cand[0]['id'], 'name': SEC_NOMBRE}
if not sec:
    assert DRY, 'falta la credencial "' + SEC_NOMBRE + '" (tipo crypto, campo hmacSecret = App Secret de OZOAGRO_agente)'
    sec = {'id': 'PENDIENTE', 'name': SEC_NOMBRE}
wh = N['Webhook POST Mensajes']
wh['parameters'].setdefault('options', {})['rawBody'] = True
xw, yw = wh['position']
firma = {'parameters': {'action': 'hmac', 'binaryData': True, 'binaryPropertyName': 'data', 'type': 'SHA256',
                        'dataPropertyName': 'firma_calculada', 'encoding': 'hex'},
         'name': 'Firma Meta', 'type': 'n8n-nodes-base.crypto', 'typeVersion': 2, 'position': [xw + 208, yw + 112],
         'credentials': {'crypto': dict(sec)}}
validar_js = r"""// Compara en tiempo constante la firma que manda Meta (X-Hub-Signature-256) con la calculada sobre el cuerpo crudo.
// Sin firma o con firma distinta: no se procesa nada (Meta igual recibio su 200 en 'Responder 200 a Meta').
const wh = $('Webhook POST Mensajes').first().json;
const recibida = String((wh.headers || {})['x-hub-signature-256'] || '');
const esperada = 'sha256=' + String($input.first().json.firma_calculada || '');
let dif = recibida.length === esperada.length && esperada.length === 71 ? 0 : 1;
for (let i = 0; i < Math.min(recibida.length, esperada.length); i++) dif |= recibida.charCodeAt(i) ^ esperada.charCodeAt(i);
if (dif !== 0) return [];
return [{ json: wh }];"""
validar = {'parameters': {'jsCode': validar_js}, 'name': 'Validar firma', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
           'position': [xw + 416, yw + 112]}
w['nodes'] += [firma, validar]
C = w['connections']
C['Webhook POST Mensajes'] = {'main': [[{'node': 'Responder 200 a Meta', 'type': 'main', 'index': 0}, {'node': 'Firma Meta', 'type': 'main', 'index': 0}]]}
C['Firma Meta'] = {'main': [[{'node': 'Validar firma', 'type': 'main', 'index': 0}]]}
C['Validar firma'] = {'main': [[{'node': 'Extraer mensaje', 'type': 'main', 'index': 0}]]}
N['Extraer mensaje']['position'] = [xw + 624, yw + 112]

w['name'] = 'OZOAGRO WhatsApp - Agente Andres v16'
txt = json.dumps(w, ensure_ascii=False)
assert AIMMA_PHONE_ID not in txt and CRED_AIMMA not in txt, 'quedo algo del numero de AIMMA'
payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('nodos:', len(w['nodes']), '| credencial:', cred, '| ->', OUT)
if DRY: print('DRY'); sys.exit(0)
assert KEY, 'falta N8N_API_KEY en el entorno'
# El flujo vivo debe ser el ultimo publicado desde el repo (n8n/OZOAGRO_WHATSAPP.json) o ya igual a este build:
# si alguien lo edito en la interfaz de n8n, NO se pisa (exportar primero esos cambios al repo).
firma = lambda d: {n['name']: json.dumps(n['parameters'], sort_keys=True) for n in d['nodes']}
vivo = api('/workflows/' + WF)
repo = json.load(open(os.path.join(os.path.dirname(S), 'n8n', 'OZOAGRO_WHATSAPP.json'), encoding='utf-8'))
if firma(vivo) not in (firma(repo), firma(payload)):
    distintos = sorted(k for k in set(firma(vivo)) | set(firma(repo)) if firma(vivo).get(k) != firma(repo).get(k))
    sys.exit('ABORTADO: el flujo vivo no coincide con n8n/OZOAGRO_WHATSAPP.json (cambiado fuera del repo). Nodos: ' + ', '.join(distintos))
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT',
                             headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r: res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
