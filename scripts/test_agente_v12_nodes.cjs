// Pruebas locales de los nodos Code de v12 (Extraer mensaje con imagen, Unir texto con descripcion) + cableado
const fs = require('fs');
const w = JSON.parse(fs.readFileSync(__dirname + '/ozo_v12.json', 'utf8'));
const N = Object.fromEntries(w.nodes.map(n => [n.name, n]));
let fallos = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
function run(name, inputItems, refs, extra) {
  const code = N[name].parameters.jsCode;
  const $input = { all: () => inputItems, first: () => inputItems[0] };
  const $ = (n) => ({ item: { json: refs[n] }, first: () => ({ json: refs[n] }) });
  const $getWorkflowStaticData = () => (extra && extra.staticData) || {};
  const fn = new Function('$input', '$', '$getWorkflowStaticData', 'return (async () => {' + code + '})()');
  return fn($input, $, $getWorkflowStaticData);
}
const meta = (msg, contacts) => ({ json: { body: { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: contacts || [{ profile: { name: 'Prueba' }, wa_id: msg.from }], messages: [msg] } }] }] } } });
(async () => {
  const ts = String(Math.floor(Date.now() / 1000));
  // imagen real (Meta): sin link
  let r = (await run('Extraer mensaje', [meta({ from: '573001', id: 'wamid.REAL1', timestamp: ts, type: 'image', image: { id: 'IMG123', mime_type: 'image/jpeg', caption: 'que tiene mi mata?' } })], {}))[0].json;
  ok(r.es_imagen && r.imagen_id === 'IMG123' && r.caption === 'que tiene mi mata?' && r.texto === 'que tiene mi mata?' && !r.es_test && r.imagen_url_test === '', 'Extraer: imagen real -> id + caption, sin url de prueba');
  // imagen de prueba: link solo si es_test
  r = (await run('Extraer mensaje', [meta({ from: '573000000199', id: 'wamid.TEST_x', timestamp: ts, type: 'image', image: { id: 'FAKE', link: 'https://ejemplo/x.jpg' } })], {}))[0].json;
  ok(r.es_test && r.imagen_url_test === 'https://ejemplo/x.jpg' && r.caption === '', 'Extraer: imagen de prueba -> link');
  r = (await run('Extraer mensaje', [meta({ from: '573001', id: 'wamid.REAL2', timestamp: ts, type: 'image', image: { id: 'X', link: 'https://malicioso/x.jpg' } })], {}))[0].json;
  ok(r.imagen_url_test === '', 'Extraer: un link en un mensaje REAL se ignora (no es test)');
  r = (await run('Extraer mensaje', [meta({ from: '573001', id: 'wamid.REAL3', timestamp: ts, type: 'text', text: { body: 'hola' } })], {}))[0].json;
  ok(r.texto === 'hola' && r.es_imagen === false && r.es_audio === false, 'Extraer: texto intacto');
  r = (await run('Extraer mensaje', [meta({ from: '573001', id: 'wamid.REAL4', timestamp: ts, type: 'audio', audio: { id: 'A1' } })], {}))[0].json;
  ok(r.es_audio && r.audio_id === 'A1' && !r.es_imagen, 'Extraer: audio intacto');
  r = (await run('Extraer mensaje', [meta({ from: '573001', id: 'wamid.REAL5', timestamp: ts, type: 'sticker' })], {}))[0].json;
  ok(/Mensaje tipo sticker/.test(r.texto), 'Extraer: otros tipos siguen con aviso');
  // Unir texto con imagen
  const origImg = { from: '573001', es_audio: false, es_imagen: true, caption: 'mire esto', texto: 'mire esto' };
  r = (await run('Unir texto', [{ json: { choices: [{ message: { content: 'Hoja de cafe con manchas anaranjadas pulverulentas en el enves.' } }] } }], { 'Extraer mensaje': origImg }))[0].json;
  ok(/^\(foto enviada por el cliente\. Lo que se ve en la foto: Hoja de cafe/.test(r.texto) && /"mire esto"/.test(r.texto) && r.fue_imagen && !r.foto_no_analizada, 'Unir: descripcion + caption');
  r = (await run('Unir texto', [{ json: { error: 'timeout' } }], { 'Extraer mensaje': { ...origImg, caption: '' } }))[0].json;
  ok(/no se pudo analizar/.test(r.texto) && r.foto_no_analizada, 'Unir: fallo de vision -> aviso al agente');
  r = (await run('Unir texto', [{ json: { text: 'hola audio' } }], { 'Extraer mensaje': { from: '1', es_audio: true, texto: '' } }))[0].json;
  ok(r.texto === 'hola audio' && r.fue_audio && !r.fue_imagen, 'Unir: audio intacto');
  r = (await run('Unir texto', [{ json: {} }], { 'Extraer mensaje': { from: '1', es_audio: false, texto: 'texto normal' } }))[0].json;
  ok(r.texto === 'texto normal', 'Unir: texto intacto');
  // cableado
  const C = w.connections;
  ok(C['Es audio'].main[1][0].node === 'Es imagen?', 'Es audio(false) -> Es imagen?');
  ok(C['Es imagen?'].main[0][0].node === 'Imagen de prueba?' && C['Es imagen?'].main[1][0].node === 'Unir texto', 'Es imagen? ramas');
  ok(C['Imagen de prueba?'].main[0][0].node === 'Descargar imagen prueba' && C['Imagen de prueba?'].main[1][0].node === 'Obtener URL imagen', 'Imagen de prueba? ramas');
  ok(C['Obtener URL imagen'].main[0][0].node === 'Descargar imagen' && C['Descargar imagen'].main[0][0].node === 'Imagen a base64' && C['Descargar imagen prueba'].main[0][0].node === 'Imagen a base64', 'descargas -> base64');
  ok(C['Imagen a base64'].main[0][0].node === 'Analizar imagen' && C['Analizar imagen'].main[0][0].node === 'Unir texto', 'base64 -> Analizar -> Unir');
  ok(!N['Descargar imagen prueba'].credentials && N['Descargar imagen'].credentials.httpHeaderAuth, 'la descarga de prueba NO lleva el token de Meta; la real si');
  ok(N['Analizar imagen'].credentials.openAiApi && /gpt-4\.1-mini/.test(N['Analizar imagen'].parameters.jsonBody) && /image_url/.test(N['Analizar imagen'].parameters.jsonBody), 'Analizar imagen: credencial OpenAI + vision');
  const sm = N['Agente OZOAGRO'].parameters.options.systemMessage;
  ok(/SI EL CLIENTE MANDA UNA FOTO/.test(sm) && /patrimonio y su cosecha/.test(sm) && /NUTRE la planta/.test(sm) && /técnico o un estudio especializado/.test(sm), 'prompt: seccion foto con el enfoque de Jorge');
  ok(/_v12_20260927/.test(N['Memoria Conversacion'].parameters.sessionKey), 'sessionKey v12');
  console.log(fallos ? 'FALLOS: ' + fallos : 'TODO OK'); process.exit(fallos ? 1 : 0);
})();
