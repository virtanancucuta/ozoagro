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
js = N['Extraer mensaje']['parameters']['jsCode']
old = "  const value = ch.value || {};\n"
new = ("  const value = ch.value || {};\n"
       "  // v15: solo el numero propio de OZOAGRO. La app de prueba de AIMMA comparte esta URL: sus mensajes se ignoran.\n"
       "  if (String((value.metadata || {}).phone_number_id || '') !== '" + OZO_PHONE_ID + "') { return []; }\n")
assert js.count(old) == 1, 'Extraer mensaje cambio'
js = js.replace(old, new)
# Remitente con formato valido: se interpola en URLs de PostgREST con service_role (ej. PATCH ?telefono=eq.X);
# un "from" falso como "1&telefono=not.is.null" haria que el PATCH tocara TODAS las conversaciones.
old = "  if (!remitente) { return []; } // sin remitente no hay a quien responder\n"
new = ("  if (!remitente) { return []; } // sin remitente no hay a quien responder\n"
       "  if (!/^(\\d{8,15}|[A-Z]{2}\\.[A-Za-z0-9]{1,64})$/.test(String(remitente))) { return []; } // formato WhatsApp valido o nada\n")
assert js.count(old) == 1, 'Extraer mensaje (remitente) cambio'
N['Extraer mensaje']['parameters']['jsCode'] = js.replace(old, new)
# los estados fallidos usan recipient_id: misma validacion
old = "      return [{ json: { es_fallo_entrega: true, from: st.recipient_id || '',"
assert js.count(old) == 1, 'Extraer mensaje (fallo) cambio'
N['Extraer mensaje']['parameters']['jsCode'] = N['Extraer mensaje']['parameters']['jsCode'].replace(
    "    if (st && st.status === 'failed') {\n",
    "    if (st && st.status === 'failed' && /^\\d{8,15}$/.test(String(st.recipient_id || ''))) {\n")
assert "/^\\d{8,15}$/.test(String(st.recipient_id" in N['Extraer mensaje']['parameters']['jsCode'], 'filtro de fallo no aplicado'

w['name'] = 'OZOAGRO WhatsApp - Agente Andres v15'
txt = json.dumps(w, ensure_ascii=False)
assert AIMMA_PHONE_ID not in txt and CRED_AIMMA not in txt, 'quedo algo del numero de AIMMA'
payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('nodos:', len(w['nodes']), '| credencial:', cred, '| ->', OUT)
if DRY: print('DRY'); sys.exit(0)
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT',
                             headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r: res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
