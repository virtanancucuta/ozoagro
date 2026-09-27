// Prueba local (Node) de los nodos Code del agente v11 con mocks de $input / $('Nodo')
const fs = require('fs');
const w = JSON.parse(fs.readFileSync(__dirname + '/ozo_v11.json', 'utf8'));
const N = Object.fromEntries(w.nodes.map(n => [n.name, n]));
let fallos = 0;
function ok(cond, msg) { console.log((cond ? 'OK   ' : 'FALLA') + ' ' + msg); if (!cond) fallos++; }
function run(name, inputItems, refs) {
  const code = N[name].parameters.jsCode;
  const $input = { all: () => inputItems, first: () => inputItems[0] };
  const $ = (n) => ({ item: { json: refs[n] }, first: () => ({ json: refs[n] }) });
  const fn = new Function('$input', '$', 'return (async () => {' + code + '})()');
  return fn($input, $);
}
(async () => {
  // ---- Armar precios: precios vivos + mayorista solo en 1 L
  const prods = [
    { json: { nombre: 'OZOAGRO 1 Litro', litros: 1, precio_venta: '129900.00', precio_mayorista: '65000.00' } },
    { json: { nombre: 'Galón (4 L)', litros: 4, precio_venta: '409900.00', precio_mayorista: null } },
    { json: { nombre: '10 Unidades', litros: 10, precio_venta: '1100000.00', precio_mayorista: null } },
    { json: { nombre: '20 Unidades', litros: 20, precio_venta: '1998000.00', precio_mayorista: null } },
  ];
  let r = (await run('Armar precios', prods, {}))[0].json;
  console.log('distribuidor =>', r.distribuidor);
  ok(r.fuente === 'bd' && r.precios[4] === 409900, 'Armar precios: precios vivos intactos');
  ok(/65\.000/.test(r.distribuidor) && /129\.900/.test(r.distribuidor) && /64\.900/.test(r.distribuidor), 'Armar precios: mayorista 1 L con precio, publico y ganancia');
  ok(/del gal.n, 10 unidades, 20 unidades se lo confirma/.test(r.distribuidor), 'Armar precios: los NULL se remiten al equipo');
  ok(!/36\.000/.test(JSON.stringify(r)), 'Armar precios: el costo de fabricacion no aparece');
  // sin mayorista
  r = (await run('Armar precios', prods.map(p => ({ json: { ...p.json, precio_mayorista: null } })), {}))[0].json;
  ok(/no des cifras/.test(r.distribuidor), 'Armar precios: sin mayoristas -> no da cifras');
  // mayorista >= venta se ignora
  r = (await run('Armar precios', prods.map(p => ({ json: { ...p.json, precio_mayorista: p.json.precio_venta } })), {}))[0].json;
  ok(/no des cifras/.test(r.distribuidor), 'Armar precios: mayorista = venta se ignora');
  // fallo de BD -> respaldo
  r = (await run('Armar precios', [{ json: {} }], {}))[0].json;
  ok(r.fuente === 'respaldo' && r.precios[1] === 129900 && /no des cifras/.test(r.distribuidor), 'Armar precios: respaldo si la BD falla');

  // ---- Unir texto: alucinaciones de Whisper
  const orig = { from: '573001', nombre: 'X', es_audio: true, texto: '' };
  r = (await run('Unir texto', [{ json: { text: 'Subtítulos realizados por la comunidad de Amara.org' } }], { 'Extraer mensaje': orig }))[0].json;
  ok(r.audio_no_entendido === true && /no se entendio/.test(r.texto), 'Unir texto: alucinacion Amara -> no entendido');
  r = (await run('Unir texto', [{ json: { text: '' } }], { 'Extraer mensaje': orig }))[0].json;
  ok(r.audio_no_entendido === true, 'Unir texto: audio vacio -> no entendido');
  r = (await run('Unir texto', [{ json: { text: 'Buenas, tengo 3 hectáreas de café en Pitalito' } }], { 'Extraer mensaje': orig }))[0].json;
  ok(r.audio_no_entendido === false && r.texto.includes('Pitalito') && r.fue_audio, 'Unir texto: audio real pasa intacto');
  r = (await run('Unir texto', [{ json: {} }], { 'Extraer mensaje': { ...orig, es_audio: false, texto: 'hola' } }))[0].json;
  ok(r.texto === 'hola' && r.audio_no_entendido === false, 'Unir texto: texto normal intacto');

  // ---- Parsear respuesta: tag INTERES_DISTRIBUIDOR + limpieza
  const raw = 'Perfecto, don Luis. El equipo de OZOAGRO lo llama para activarle su panel. [DATO_NOMBRE:Luis Rojas] [DATO_CIUDAD:Pitalito] [INTERES_DISTRIBUIDOR:{"nombre":"Luis Rojas","ciudad":"Pitalito","departamento":"Huila","negocio":"agropecuaria","zona":"sur del Huila","email":""}]';
  r = (await run('Parsear respuesta', [{ json: { output: raw } }], { 'Extraer mensaje': { from: '573001' } }))[0].json;
  ok(r.tiene_interes && r.interes.nombre === 'Luis Rojas' && r.interes.zona === 'sur del Huila', 'Parsear: interes parseado');
  ok(!/\[/.test(r.respuesta) && r.respuesta.endsWith('panel.'), 'Parsear: texto limpio sin tags');
  ok(r.tiene_datos && r.datos.nombre === 'Luis Rojas', 'Parsear: DATO_ sigue funcionando');
  r = (await run('Parsear respuesta', [{ json: { output: 'Hola [CREAR_PEDIDO:{"nombre":"A","combo_litros":4,"cantidad":1}]' } }], { 'Extraer mensaje': { from: '573001' } }))[0].json;
  ok(r.tiene_pedido && r.pedido.combo_litros === 4 && !r.tiene_interes && r.respuesta === 'Hola', 'Parsear: CREAR_PEDIDO sigue funcionando');

  // ---- Fusionar interes: merge con metadata previa
  const parse = { from: '573001', interes: { nombre: 'Luis Rojas', ciudad: 'Pitalito', departamento: '', negocio: 'agropecuaria', zona: '', email: '' } };
  r = (await run('Fusionar interes', [{ json: { id: 'u1', metadata: { otra: 1, interes_distribuidor: { nombre: 'Luis', zona: 'Huila', veces: 1, primera_vez: '2026-01-01T00:00:00.000Z', estado: 'contactado' } } } }], { 'Parsear respuesta': parse }))[0].json;
  const m = r.metadata.interes_distribuidor;
  ok(r.metadata.otra === 1, 'Fusionar: conserva otras llaves de metadata');
  ok(m.nombre === 'Luis Rojas' && m.zona === 'Huila' && m.departamento === undefined, 'Fusionar: pisa con datos nuevos, conserva los viejos, ignora vacios');
  ok(m.veces === 2 && m.primera_vez === '2026-01-01T00:00:00.000Z' && m.estado === 'contactado' && m.telefono === '573001', 'Fusionar: veces/primera_vez/estado/telefono');
  r = (await run('Fusionar interes', [{ json: {} }], { 'Parsear respuesta': parse }))[0].json;
  ok(r.existe === false && r.metadata.interes_distribuidor.veces === 1 && r.metadata.interes_distribuidor.estado === 'nuevo', 'Fusionar: sin fila previa (GET vacio) sigue funcionando');

  // ---- Preparar media: URL nueva
  ok(/https:\/\/ozoagro\.co\/media\//.test(N['Preparar media'].parameters.jsCode), 'Preparar media apunta a ozoagro.co/media');
  // ---- Conexiones nuevas
  const C = w.connections;
  ok(C['Parsear respuesta'].main[0].some(e => e.node === 'Hay interes distribuidor?'), 'conexion Parsear -> Hay interes');
  ok(C['Hay interes distribuidor?'].main[0][0].node === 'Leer conversacion' && C['Leer conversacion'].main[0][0].node === 'Fusionar interes' && C['Fusionar interes'].main[0][0].node === 'Guardar interes distribuidor', 'cadena interes completa');
  ok(/_v11_20260927/.test(N['Memoria Conversacion'].parameters.sessionKey), 'sessionKey v11');
  ok(/precio_mayorista/.test(N['Precios actuales'].parameters.url) && !/costo/.test(N['Precios actuales'].parameters.url), 'Precios actuales pide mayorista y no costo');
  const sm = N['Agente OZOAGRO'].parameters.options.systemMessage;
  ok(/json\.distribuidor \}\}/.test(sm) && /INTERES_DISTRIBUIDOR/.test(sm) && /no se entendió/.test(sm), 'prompt referencia distribuidor, tag y audio');
  console.log(fallos ? ('FALLOS: ' + fallos) : 'TODO OK');
  process.exit(fallos ? 1 : 0);
})();
