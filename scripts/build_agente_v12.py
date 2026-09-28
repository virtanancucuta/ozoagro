# -*- coding: utf-8 -*-
"""Agente Andres v12 = v11 (ozo_v11_server.json) + analisis de FOTOS del cliente (vision) con enfoque de venta prudente."""
import json, sys, os, uuid, copy, urllib.request

S = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.join(S, 'ozo_v11_server.json')  # JSON del flujo v11 (n8n/OZOAGRO_WHATSAPP.json del commit a7041db)
OUT = os.path.join(S, 'ozo_v12.json')
N8N = 'https://dvisualproyect-n8n.pgnm3b.easypanel.host'
WF = '4KA11Mhc7Qs4HzDt'
KEY = os.environ.get('N8N_API_KEY', '')  # exportar antes de correr
META_CRED = {'httpHeaderAuth': {'id': 'HxFbYAP7T9Wi7vGc', 'name': 'AIMMA Meta WhatsApp Token'}}
OPENAI_CRED = {'openAiApi': {'id': 'Gy1kSNlEmpsaTTwE', 'name': 'AIMMA OpenAI'}}

w = json.load(open(LIVE, encoding='utf-8'))
N = {n['name']: n for n in w['nodes']}
def nid(): return str(uuid.uuid4())

# ---------- 1. Extraer mensaje: imagenes ----------
em = N['Extraer mensaje']['parameters']['jsCode']
old = """  if (t === 'text') { texto = (msg.text || {}).body || ''; }
  else if (t === 'audio') { es_audio = true; audio_id = (msg.audio || {}).id || ''; }
  else { texto = '[Mensaje tipo ' + t + '. Pidele que escriba o envie audio.]'; }
  // Modo test: ids 'wamid.TEST_' desde numeros ficticios NO se envian a Meta (se registra todo en BD igual)
  const es_test = String(msg.id || '').startsWith('wamid.TEST_') && String(remitente) !== '573172625415';
  return [{ json: { from: remitente, nombre: (contact.profile || {}).name || (contact.profile || {}).username || '', tipo: t, message_id: msg.id, es_audio, audio_id, texto, es_test } }];"""
new = """  // Modo test: ids 'wamid.TEST_' desde numeros ficticios NO se envian a Meta (se registra todo en BD igual)
  const es_test = String(msg.id || '').startsWith('wamid.TEST_') && String(remitente) !== '573172625415';
  let es_imagen = false, imagen_id = '', caption = '', imagen_url_test = '';
  if (t === 'text') { texto = (msg.text || {}).body || ''; }
  else if (t === 'audio') { es_audio = true; audio_id = (msg.audio || {}).id || ''; }
  else if (t === 'image') {
    // v12: foto del cliente -> se descarga de Meta y se analiza con vision antes de pasar al agente
    es_imagen = true; imagen_id = (msg.image || {}).id || ''; caption = String((msg.image || {}).caption || '').trim();
    if (es_test) imagen_url_test = String((msg.image || {}).link || ''); // solo pruebas: URL publica en vez de Meta
    texto = caption;
  }
  else { texto = '[Mensaje tipo ' + t + '. Pidele que escriba, envie audio o una foto.]'; }
  return [{ json: { from: remitente, nombre: (contact.profile || {}).name || (contact.profile || {}).username || '', tipo: t, message_id: msg.id, es_audio, audio_id, es_imagen, imagen_id, caption, imagen_url_test, texto, es_test } }];"""
assert old in em, 'Extraer mensaje cambio'
N['Extraer mensaje']['parameters']['jsCode'] = em.replace(old, new)

# ---------- 2. Unir texto: descripcion de la foto ----------
ut = N['Unir texto']['parameters']['jsCode']
old = "return [{ json: { ...orig, texto, fue_audio: !!orig.es_audio, audio_no_entendido } }];"
new = """// v12: foto del cliente -> lo que vio el modelo de vision entra como texto marcado
let foto_no_analizada = false;
if (orig.es_imagen) {
  let d = '';
  try { d = String((($input.first().json.choices || [])[0] || {}).message?.content || '').trim(); } catch (e) {}
  if (d) { texto = '(foto enviada por el cliente. Lo que se ve en la foto: ' + d + ')'; }
  else { texto = '(foto enviada por el cliente que no se pudo analizar: pidale que la mande de nuevo mas cerca y con luz, o que le cuente que ve)'; foto_no_analizada = true; }
  if (orig.caption) texto += ' El cliente escribio junto a la foto: "' + orig.caption + '"';
}
return [{ json: { ...orig, texto, fue_audio: !!orig.es_audio, audio_no_entendido, fue_imagen: !!orig.es_imagen, foto_no_analizada } }];"""
assert old in ut
N['Unir texto']['parameters']['jsCode'] = ut.replace(old, new)

# ---------- 3. Nodos nuevos de la rama imagen ----------
if_img = copy.deepcopy(N['Es audio']); if_img.update({'id': nid(), 'name': 'Es imagen?', 'position': [416, 40]})
if_img['parameters']['conditions']['conditions'] = [{'id': 'c-imagen', 'leftValue': '={{ $json.es_imagen }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}]
if_test = copy.deepcopy(N['Es audio']); if_test.update({'id': nid(), 'name': 'Imagen de prueba?', 'position': [624, 40]})
if_test['parameters']['conditions']['conditions'] = [{'id': 'c-imgtest', 'leftValue': '={{ $json.imagen_url_test }}', 'rightValue': '', 'operator': {'type': 'string', 'operation': 'notEmpty', 'singleValue': True}}]
get_url = copy.deepcopy(N['Obtener URL media']); get_url.update({'id': nid(), 'name': 'Obtener URL imagen', 'position': [832, 80]})
get_url['parameters']['url'] = "=https://graph.facebook.com/v25.0/{{ $('Extraer mensaje').item.json.imagen_id }}"
dl = copy.deepcopy(N['Descargar audio']); dl.update({'id': nid(), 'name': 'Descargar imagen', 'position': [1040, 80]})
dl_test = {  # SOLO pruebas: URL publica, SIN el token de Meta (no se filtra a terceros)
  'parameters': {'url': "={{ $('Extraer mensaje').item.json.imagen_url_test }}", 'sendHeaders': True,
                 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; ozoagro-agente-test/1.0)'}]},
                 'options': {'response': {'response': {'responseFormat': 'file'}}}},
  'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [1040, -60], 'id': nid(), 'name': 'Descargar imagen prueba'}
b64 = {'parameters': {'jsCode': """// Binario -> base64 para mandarlo a OpenAI (la URL de Meta exige token, OpenAI no la puede leer)
const item = $input.first();
const bin = (item.binary && item.binary.data) || {};
const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
return [{ json: { b64: buf.toString('base64'), mime: bin.mimeType || 'image/jpeg', bytes: buf.length } }];"""},
  'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [1248, 40], 'id': nid(), 'name': 'Imagen a base64'}
VISION_SYS = ("Eres un agronomo que describe fotos enviadas por agricultores colombianos por WhatsApp. Describe de forma OBJETIVA y en espanol lo que se ve, en maximo 90 palabras: "
  "si es una planta o cultivo (y cual parece), que parte se ve (hoja, fruto, tallo, raiz, suelo, cultivo completo), sintomas visibles (manchas y su color, pustulas o polvo, moho, "
  "amarillamiento, marchitez, enrollamiento, perforaciones, insectos y de que tipo parecen, dano mecanico) y el estado general. Si la foto NO es de una planta, di brevemente que es. "
  "Si esta borrosa u oscura, dilo. No des diagnosticos definitivos ni recomiendes productos: solo describe.")
analizar = {
  'parameters': {'method': 'POST', 'url': 'https://api.openai.com/v1/chat/completions',
    'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'openAiApi',
    'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Content-Type', 'value': 'application/json'}]},
    'sendBody': True, 'specifyBody': 'json',
    'jsonBody': "={{ JSON.stringify({ model: 'gpt-4.1-mini', max_tokens: 300, temperature: 0.2, messages: [ { role: 'system', content: " + json.dumps(VISION_SYS) + " }, { role: 'user', content: [ { type: 'text', text: ($('Extraer mensaje').item.json.caption ? 'El cliente escribio: ' + $('Extraer mensaje').item.json.caption : 'Describe la foto.') }, { type: 'image_url', image_url: { url: 'data:' + $json.mime + ';base64,' + $json.b64 } } ] } ] }) }}",
    'options': {'timeout': 60000}},
  'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2, 'position': [1456, 40], 'id': nid(), 'name': 'Analizar imagen',
  'credentials': OPENAI_CRED, 'onError': 'continueRegularOutput', 'retryOnFail': True}
for n in (if_img, if_test, get_url, dl, dl_test, b64, analizar):
    assert n['name'] not in N, n['name']; w['nodes'].append(n)
C = w['connections']
# Es audio (false) -> Es imagen? ; Es imagen? true -> Imagen de prueba? ; false -> Unir texto
C['Es audio']['main'][1] = [{'node': 'Es imagen?', 'type': 'main', 'index': 0}]
C['Es imagen?'] = {'main': [[{'node': 'Imagen de prueba?', 'type': 'main', 'index': 0}], [{'node': 'Unir texto', 'type': 'main', 'index': 0}]]}
C['Imagen de prueba?'] = {'main': [[{'node': 'Descargar imagen prueba', 'type': 'main', 'index': 0}], [{'node': 'Obtener URL imagen', 'type': 'main', 'index': 0}]]}
C['Obtener URL imagen'] = {'main': [[{'node': 'Descargar imagen', 'type': 'main', 'index': 0}]]}
C['Descargar imagen'] = {'main': [[{'node': 'Imagen a base64', 'type': 'main', 'index': 0}]]}
C['Descargar imagen prueba'] = {'main': [[{'node': 'Imagen a base64', 'type': 'main', 'index': 0}]]}
C['Imagen a base64'] = {'main': [[{'node': 'Analizar imagen', 'type': 'main', 'index': 0}]]}
C['Analizar imagen'] = {'main': [[{'node': 'Unir texto', 'type': 'main', 'index': 0}]]}
# mover un poco los nodos de audio para que no se encimen
for name, pos in (('Obtener URL media', [624, 208]), ('Descargar audio', [832, 208]), ('Transcribir audio', [1040, 208])): N[name]['position'] = pos

# ---------- 4. Prompt v12 ----------
sm = N['Agente OZOAGRO']['parameters']['options']['systemMessage']
old = "# SER DISTRIBUIDOR DE OZOAGRO (oportunidad de negocio)"
new = """# SI EL CLIENTE MANDA UNA FOTO (llega como "(foto enviada por el cliente. Lo que se ve en la foto: ...)")
1. Coméntala primero con interés y en palabras sencillas: "Le vi la foto...". Di lo que PARECE, con prudencia ("por lo que se ve, parece un hongo en la hoja", "se ven insectos pequeños"), nunca un diagnóstico seguro ni un nombre de enfermedad como si fuera un hecho.
2. SIEMPRE, cada vez que comentes una foto, dilo con tus palabras y sin saltarte ninguna de las tres ideas: (a) con fotos o imágenes no se puede estar seguro de nada, (b) es su patrimonio y su cosecha, (c) por eso siempre recomendamos un técnico o un estudio especializado que lo confirme en campo.
3. Sin embargo, conecta con OZOAGRO en la misma respuesta: mientras lo confirma con el técnico, OZOAGRO le protege el cultivo de hongos, bacterias y virus, le repele los insectos de cuerpo blando y además NUTRE la planta: mejora la clorofila, oxigena las raíces y desbloquea el suelo, sin residuos ni días de carencia. Y sigue el método de venta: REVISA si el cliente ya dijo cuántas hectáreas tiene (junto a la foto o antes en el historial): si lo dijo, NO vuelvas a preguntarlo; recomienda en ese mismo mensaje la presentación con su precio, valor por litro y ahorro, y cierra con una pregunta de venta (ejemplo: "Para sus 3 hectáreas le recomiendo el galón de 4 litros: vale $409.900, le sale a $102.475 el litro y ahorra $109.700. ¿Se lo despacho? El envío es gratis y paga cuando le llegue"). Solo si no lo sabes, pregunta cuántas hectáreas tiene o qué cultivo es (una sola pregunta).
4. Nunca prometas que OZOAGRO cura o quita lo que se ve en la foto. Si lo que se ve no es algo que OZOAGRO cubre (daño mecánico, falta de agua, problema de suelo o raíz, nematodos), dilo con honestidad y ofrécelo como protección y nutrición general, sin forzar.
5. Si la foto está borrosa, oscura o no se ve el problema, pídele otra más cerca y con luz. Si la foto no es de una planta (un recibo, un pantallazo, una persona), coméntala con naturalidad y retoma la conversación. Si llega "(foto enviada por el cliente que no se pudo analizar...)", pídele que la mande otra vez o que le cuente qué ve.
6. Foto = máximo 5 líneas en ese mensaje (es la excepción a las 3 líneas), UNA sola pregunta al final.

# SER DISTRIBUIDOR DE OZOAGRO (oportunidad de negocio)"""
assert old in sm and 'SI EL CLIENTE MANDA UNA FOTO' not in sm
sm = sm.replace(old, new, 1)
old2 = "- Si el mensaje llega como \"(nota de voz que no se entendió)\""
assert old2 in sm
sm = sm.replace(old2, "- Si el cliente manda una FOTO, sigue la sección \"SI EL CLIENTE MANDA UNA FOTO\".\n" + old2, 1)
N['Agente OZOAGRO']['parameters']['options']['systemMessage'] = sm
N['Memoria Conversacion']['parameters']['sessionKey'] = '={{ $("Extraer mensaje").item.json.from }}_v12_20260927'
w['name'] = 'OZOAGRO WhatsApp - Agente Andres v12'

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': w['settings']}
json.dump(payload, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(S, 'prompt_v12.md'), 'w', encoding='utf-8').write(sm)
print('nodos:', len(w['nodes']), '| prompt:', len(sm), 'chars | salida:', OUT)
if '--dry' in sys.argv: print('DRY: no se sube'); sys.exit(0)
req = urllib.request.Request(N8N + '/api/v1/workflows/' + WF, data=json.dumps(payload).encode('utf-8'), method='PUT',
                             headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as r: res = json.load(r)
print('PUT OK:', res['name'], '| nodes', len(res['nodes']), '| active', res['active'], '| versionId', res.get('versionId'))
