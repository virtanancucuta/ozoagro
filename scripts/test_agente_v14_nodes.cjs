// Pruebas locales de los nodos Code del agente v14 (Parsear respuesta, Preparar envios, Armar precios).
// Uso: node scripts/test_agente_v14_nodes.cjs scripts/ozo_v14.json
const fs=require('fs');const w=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const N={};w.nodes.forEach(n=>N[n.name]=n);
function run(code,ctx,input){const $=(n)=>({item:{json:ctx[n]},first:()=>({json:ctx[n]})});const $input={first:()=>({json:input[0]}),all:()=>input.map(j=>({json:j}))};
 return new Function('$','$input',code)($,$input);}
let ok=0,fail=0;const t=(name,c)=>{if(c){ok++;console.log('OK   ',name)}else{fail++;console.log('FALLA',name)}};
const P=N['Parsear respuesta'].parameters.jsCode;const ex={from:'573000000201',es_test:true};
let r=run(P,{'Extraer mensaje':ex},[{output:'Listo, ahí se la envío. [ENVIAR_FICHA]'}])[0].json;
t('parsea ficha y limpia tag',r.ficha&&!r.redes&&r.respuesta==='Listo, ahí se la envío.'&&r.media===null);
r=run(P,{'Extraer mensaje':ex},[{output:'Gracias don Pedro. [ENVIAR_REDES]'}])[0].json;t('parsea redes y limpia tag',r.redes&&r.respuesta==='Gracias don Pedro.');
r=run(P,{'Extraer mensaje':ex},[{output:'Mire el video [ENVIAR_VIDEO_PAPAYA]'}])[0].json;t('video sigue funcionando',r.media==='video_papaya'&&!r.ficha&&r.respuesta==='Mire el video');
r=run(P,{'Extraer mensaje':ex},[{output:''}])[0].json;t('respaldo con tildes correctas',r.fallback&&r.respuesta.includes('señal')&&r.respuesta.includes('¿'));
const E=N['Preparar envios'].parameters.jsCode;
const conv=(msgs,meta={})=>[{id:'c1',metadata:meta,wa_mensajes:msgs}];
const pr=(o)=>Object.assign({from:'573000000201',media:null,ficha:false,redes:false,tiene_pedido:false},o);
let o=run(E,{'Parsear respuesta':pr({ficha:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'Listo'},{rol:'user',contenido:'sí, mándela'},{rol:'assistant',contenido:'¿Le envío la ficha técnica en PDF?'}]));
t('ficha ofrecida antes -> sale como documento',o.length===1&&o[0].json.tipo==='ficha'&&o[0].json.payload.type==='document'&&o[0].json.payload.document.filename.endsWith('.pdf'));
o=run(E,{'Parsear respuesta':pr({ficha:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'Listo'},{rol:'user',contenido:'cuánto vale'},{rol:'assistant',contenido:'Buenas tardes'}]));
t('ficha NO ofrecida ni pedida -> bloqueada',o.length===0);
o=run(E,{'Parsear respuesta':pr({ficha:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'Listo'},{rol:'user',contenido:'me manda la ficha técnica?'},{rol:'assistant',contenido:'Hola'}]));
t('ficha pedida por el cliente -> sale',o.length===1&&o[0].json.tipo==='ficha');
o=run(E,{'Parsear respuesta':pr({redes:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'x'}]));
t('redes primera vez -> sale con los 4 enlaces',o.length===1&&o[0].json.tipo==='redes'&&['ozoagrolatam.com','facebook.com/latamozoagro','instagram.com/ozoagro','tiktok.com/@ozoagrolatam'].every(u=>o[0].json.payload.text.body.includes(u)));
o=run(E,{'Parsear respuesta':pr({redes:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'x'}],{redes_enviadas:'2026-10-12'}));
t('redes ya enviadas -> no repite',o.length===0);
o=run(E,{'Parsear respuesta':pr({tiene_pedido:true,media:'video_papaya'}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'x'}],{interes_distribuidor:{a:1}}));
t('pedido -> video y luego redes, conserva metadata',o.length===2&&o[0].json.tipo==='video_papaya'&&o[1].json.tipo==='redes'&&o[1].json.metadata.interes_distribuidor.a===1);
o=run(E,{'Parsear respuesta':pr({}),'Extraer mensaje':ex},[{}]);t('sin nada que enviar -> vacio',o.length===0);
o=run(E,{'Parsear respuesta':pr({redes:true}),'Extraer mensaje':ex},[{}]);t('lectura fallida -> redes igual salen',o.length===1);
o=run(E,{'Parsear respuesta':pr({media:'imagen'}),'Extraer mensaje':{from:'5730',es_test:false}},conv([]));t('foto del producto en modo real',o.length===1&&o[0].json.payload.image.link.endsWith('producto.jpg')&&o[0].json.es_test===false);
o=run(E,{'Parsear respuesta':pr({ficha:true,redes:true}),'Extraer mensaje':ex},conv([{rol:'assistant',contenido:'Listo'},{rol:'user',contenido:'sí'},{rol:'assistant',contenido:'¿Le envío la ficha?'}],{x:1}));
t('ficha+redes -> ambas marcas en la metadata de cada item',o.length===2&&o.every(i=>i.json.metadata.ficha_enviada&&i.json.metadata.redes_enviadas&&i.json.metadata.x===1));
const A=N['Armar precios'].parameters.jsCode;o=run(A,{},[{litros:1,precio_venta:129900},{litros:4,precio_venta:409900},{litros:10,precio_venta:1100000},{litros:20,precio_venta:1998000}])[0].json;
t('precios: rendimiento en tanques, sin hectareas',o.bloque.includes('4 tanques de 200 litros')&&!/hect/.test(o.bloque));
console.log(`\n${ok} OK, ${fail} fallas`);process.exit(fail?1:0);
