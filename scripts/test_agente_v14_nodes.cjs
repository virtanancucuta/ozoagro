// Pruebas locales de los nodos Code del agente v14 (Extraer mensaje, Parsear respuesta, Preparar envios,
// Confirmar envios, Unir marcas, Armar precios). Uso: node scripts/test_agente_v14_nodes.cjs scripts/ozo_v14.json
const fs = require('fs'); const w = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const N = {}; w.nodes.forEach(n => N[n.name] = n);
// ctx: datos que devuelven $('Nodo').item/.first()/.all()/.itemMatching(i)
function run(code, ctx, input, extra = {}) {
  const $ = (n) => { const v = ctx[n]; const arr = Array.isArray(v) ? v : [v];
    return { item: { json: arr[0] }, first: () => ({ json: arr[0] }), all: () => arr.map(j => ({ json: j })), itemMatching: (i) => ({ json: arr[i] }) }; };
  const $input = { first: () => ({ json: input[0] }), all: () => input.map(j => ({ json: j })) };
  return new Function('$', '$input', '$getWorkflowStaticData', code)($, $input, extra.static || (() => ({})));
}
let ok = 0, fail = 0; const t = (name, c) => { if (c) { ok++; console.log('OK   ', name) } else { fail++; console.log('FALLA', name) } };

// --- Extraer mensaje: lista blanca de imagenes de prueba (SSRF) ---
const X = N['Extraer mensaje'].parameters.jsCode; const st = {};
const img = (link) => run(X, {}, [{ body: { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1436278792892245' }, contacts: [{ wa_id: '573000000499' }],
  messages: [{ from: '573000000499', id: 'wamid.TEST_' + Math.random(), timestamp: String(Math.floor(Date.now() / 1000)), type: 'image', image: { id: 'X', link, caption: 'mire' } }] } }] }] } }], { static: () => st })[0].json;
for (const [l, okk] of [['https://upload.wikimedia.org/a.jpg', true], ['https://thumb.wikimedia.org/a.jpg', true], ['http://upload.wikimedia.org/a.jpg', false],
  ['http://169.254.169.254/latest', false], ['https://n8n:5678/x', false], ['https://upload.wikimedia.org.evil.com/a', false]]) {
  const r = img(l);
  t('imagen prueba ' + l, okk ? (r.imagen_url_test === l && r.es_imagen) : (r.imagen_url_test === '' && !r.es_imagen && r.texto.startsWith('(foto enviada por el cliente que no se pudo analizar)')));
}

// --- Parsear respuesta ---
const P = N['Parsear respuesta'].parameters.jsCode; const ex = { from: '573000000201', es_test: true };
let r = run(P, { 'Extraer mensaje': ex }, [{ output: 'Listo, ahí se la envío. [ENVIAR_FICHA]' }])[0].json;
t('parsea ficha y limpia tag', r.ficha && !r.redes && r.respuesta === 'Listo, ahí se la envío.' && r.media === null);
r = run(P, { 'Extraer mensaje': ex }, [{ output: 'Gracias don Pedro. [ENVIAR_REDES]' }])[0].json; t('parsea redes y limpia tag', r.redes && r.respuesta === 'Gracias don Pedro.');
r = run(P, { 'Extraer mensaje': ex }, [{ output: 'Mire el video [ENVIAR_VIDEO_PAPAYA]' }])[0].json; t('video sigue funcionando', r.media === 'video_papaya' && !r.ficha && r.respuesta === 'Mire el video');
r = run(P, { 'Extraer mensaje': ex }, [{ output: '' }])[0].json; t('respaldo con tildes correctas', r.fallback && r.respuesta.includes('señal') && r.respuesta.includes('¿'));

// --- Preparar envios ---
const E = N['Preparar envios'].parameters.jsCode;
const conv = (msgs, meta = {}) => [{ id: 'c1', metadata: meta, wa_mensajes: msgs }];
const pr = (o) => Object.assign({ from: '573000000201', media: null, ficha: false, redes: false, tiene_pedido: false, pedido: null }, o);
const prep = (p, input) => run(E, { 'Parsear respuesta': p, 'Extraer mensaje': ex }, input);
let o = prep(pr({ ficha: true }), conv([{ rol: 'assistant', contenido: 'Listo' }, { rol: 'user', contenido: 'sí, mándela' }, { rol: 'assistant', contenido: '¿Le envío la ficha técnica en PDF?' }]));
t('ficha ofrecida antes -> sale como documento con marca', o.length === 1 && o[0].json.tipo === 'ficha' && o[0].json.payload.type === 'document' && o[0].json.marca === 'ficha_enviada');
o = prep(pr({ ficha: true }), conv([{ rol: 'assistant', contenido: 'Listo' }, { rol: 'user', contenido: 'cuánto vale' }, { rol: 'assistant', contenido: 'Buenas tardes' }]));
t('ficha NO ofrecida ni pedida -> bloqueada', o.length === 0);
o = prep(pr({ ficha: true }), conv([{ rol: 'assistant', contenido: 'Listo' }, { rol: 'user', contenido: 'me manda la ficha técnica?' }, { rol: 'assistant', contenido: 'Hola' }]));
t('ficha pedida por el cliente -> sale', o.length === 1 && o[0].json.tipo === 'ficha');
o = prep(pr({ ficha: true }), conv([{ rol: 'assistant', contenido: 'Listo' }, { rol: 'user', contenido: 'sí' }, { rol: 'assistant', contenido: '[Video de resultados en papaya enviado]' }, { rol: 'assistant', contenido: 'Le mando el video. ¿Le envío también la ficha técnica en PDF?' }]));
t('registro de video entre medio no bloquea la ficha ofrecida', o.length === 1 && o[0].json.tipo === 'ficha');
o = prep(pr({ ficha: true }), conv([{ rol: 'assistant', contenido: 'Listo' }, { rol: 'user', contenido: 'gracias' }, { rol: 'assistant', contenido: '[Ficha técnica OZOAGRO enviada en PDF]' }, { rol: 'assistant', contenido: 'Ahí va' }]));
t('el registro "[Ficha ... enviada]" no habilita un reenvio no pedido', o.length === 0);
o = prep(pr({ redes: true }), conv([{ rol: 'assistant', contenido: 'x' }]));
t('redes primera vez -> 4 enlaces y marca', o.length === 1 && o[0].json.marca === 'redes_enviadas' && ['ozoagrolatam.com', 'facebook.com/latamozoagro', 'instagram.com/ozoagro', 'tiktok.com/@ozoagrolatam'].every(u => o[0].json.payload.text.body.includes(u)));
o = prep(pr({ redes: true }), conv([{ rol: 'assistant', contenido: 'x' }], { redes_enviadas: '2026-10-12' }));
t('redes ya enviadas -> no repite', o.length === 0);
o = prep(pr({ tiene_pedido: true, pedido: { nombre: 'x' }, media: 'video_papaya' }), conv([{ rol: 'assistant', contenido: 'x' }]));
t('pedido valido -> video y luego redes', o.length === 2 && o[0].json.tipo === 'video_papaya' && o[1].json.tipo === 'redes');
o = prep(pr({ tiene_pedido: true, pedido: { parse_error: true, raw: '{' } }), conv([{ rol: 'assistant', contenido: 'x' }]));
t('pedido mal formado -> NO dispara redes', o.length === 0);
o = prep(pr({}), [{}]); t('sin nada que enviar -> vacio', o.length === 0);
o = prep(pr({ redes: true, ficha: true }), [{}]); t('lectura fallida -> ni ficha ni redes (falla cerrado)', o.length === 0);
o = prep(pr({ media: 'imagen', redes: true }), [{}]); t('lectura fallida -> la foto pedida igual sale', o.length === 1 && o[0].json.tipo === 'imagen');

// --- Confirmar envios + Unir marcas ---
const CF = N['Confirmar envios'].parameters.jsCode, U = N['Unir marcas'].parameters.jsCode;
const enviados = [{ from: 'f', tipo: 'ficha', registro: '[Ficha]', marca: 'ficha_enviada' }, { from: 'f', tipo: 'redes', registro: 'R', marca: 'redes_enviadas' }];
o = run(CF, { 'Preparar envios': enviados }, [{ messages: [{}] }, { messages: [{}] }]);
t('confirmar normaliza lo enviado', o.length === 2 && o[1].json.marca === 'redes_enviadas' && o[0].json.registro === '[Ficha]');
o = run(U, { 'Leer contexto envios': [{ id: 'c1', metadata: { interes_distribuidor: { a: 1 } } }] }, enviados);
t('unir marcas: una escritura que conserva metadata y suma ambas marcas', o.length === 1 && o[0].json.metadata.interes_distribuidor.a === 1 && o[0].json.metadata.ficha_enviada && o[0].json.metadata.redes_enviadas);
o = run(U, { 'Leer contexto envios': [{ id: 'c1', metadata: {} }] }, [{ from: 'f', marca: null }]); t('unir marcas: video solo -> no escribe', o.length === 0);
o = run(U, { 'Leer contexto envios': [{}] }, enviados); t('unir marcas: sin conversacion leida -> no pisa metadata', o.length === 0);
t('Enviar media separa exito/error', N['Enviar media'].onError === 'continueErrorOutput' && w.connections['Enviar media'].main[0][0].node === 'Confirmar envios' && w.connections['Enviar media'].main[1].length === 0);

// --- Armar precios ---
const A = N['Armar precios'].parameters.jsCode; o = run(A, {}, [{ litros: 1, precio_venta: 129900 }, { litros: 4, precio_venta: 409900 }, { litros: 10, precio_venta: 1100000 }, { litros: 20, precio_venta: 1998000 }])[0].json;
t('precios: rendimiento con la dosis de la ficha (1 L = 2 a 2,8 tanques), sin hectareas', o.bloque.includes('Alcanza para 2 a 2,8 tanques de 200 litros') && o.bloque.includes('8 a 11,4 tanques') && !/hect/.test(o.bloque));
t('bomba de 20 L con hasta 50 ml', o.bomba.includes('hasta 50 ml') && o.bomba.includes('con el litro hasta $6.495') && o.objecion.startsWith('hasta '));
t('modelo de produccion gpt-4.1', N['OpenAI Chat Model'].parameters.model.value === 'gpt-4.1');
console.log(`\n${ok} OK, ${fail} fallas`); process.exit(fail ? 1 : 0);
