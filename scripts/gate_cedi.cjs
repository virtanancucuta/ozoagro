// GATE OZOAGRO · flujo CEDI (venta al distribuidor), precio mayorista y costo oculto al distribuidor.
// Panel LOCAL (repo parcheado, http://localhost:8799/panel/) contra la BD de PRODUCCIÓN (migración ya aplicada).
// Actores reales: CEO (ceo@ozoagro.co) y distribuidor `jorge` (jorge@distribuidores.ozoagro.co). El pedido de prueba se crea
// por la landing del distribuidor (crear_pedido_web slug jorge), se marca es_test y al final se CANCELA; los dos movimientos de
// inventario que genera el despacho del CEDI (salida CEO / entrada jorge) se retiran por id al final.
const { chromium } = require('C:/Users/Usuario/Desktop/proyecto_aimma/aimma-website/node_modules/playwright-core');
const { execFileSync } = require('child_process');
const SQL = (q) => JSON.parse(execFileSync('python', ['C:/Users/Usuario/AppData/Local/Temp/claude/C--Users-Usuario/1bba2347-472c-431b-8e08-df474627bb12/scratchpad/ozo_sql.py', q], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }));
const BASE = 'https://vlcxeajnucdkwamcivgy.supabase.co', ANON = process.env.OZO_ANON, PANEL = 'http://localhost:8799/panel/';
const R = []; const ok = (n, c, d) => R.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (d ? ' — ' + String(d).slice(0, 900) : ''));
async function login(browser, user, pass) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage(); p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message.slice(0, 120))); p.on('dialog', d => d.accept());
  await p.goto(PANEL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.fill('#login-email', user); await p.fill('#login-password', pass); await p.click('button[type=submit]');
  await p.waitForFunction(() => !document.querySelector('#login-email') || document.querySelector('#login-email').offsetParent === null, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500); return p;
}
const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s) || document.body).innerText.replace(/\s+/g, ' '), sel || '#module-container');
async function modulo(p, name) { await p.evaluate((n) => { const a = document.querySelector(`[data-module="${n}"], a[href="#${n}"], [onclick*="'${n}'"]`); if (a) a.click(); else if (window.loadModule) window.loadModule(n); else location.hash = '#' + n; }, name); await p.waitForTimeout(3000); }
async function tokenDe(p) { return p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes('auth-token')) { try { return JSON.parse(localStorage.getItem(k)).access_token; } catch (_) {} } return null; }); }
async function rest(tk, path) { const r = await fetch(BASE + '/rest/v1/' + path, { headers: { apikey: ANON, Authorization: 'Bearer ' + tk } }); let j = null; try { j = await r.json(); } catch (_) {} return { status: r.status, j }; }
let pedidoId = null, codigo = null; const invIds = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const galon = SQL("select id from productos where litros=4 and activo limit 1")[0].id;
  const jorgeId = SQL("select id from distribuidores where slug='jorge'")[0].id;
  // ---- 0) pedido de prueba por la landing del distribuidor jorge (RPC anon, como la landing)
  const rw = await (await fetch(BASE + '/rest/v1/rpc/crear_pedido_web', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_nombre: 'QA CEDI', p_telefono: '3009990001', p_producto_id: galon, p_cantidad: 1, p_ciudad: 'Cúcuta', p_direccion: 'Calle QA', p_distribuidor_slug: 'jorge' }) })).json();
  pedidoId = rw.pedido_id; codigo = rw.codigo;   // el panel oculta es_test: se marca al FINAL (limpieza)
  const it0 = SQL(`select p.estado, p.estado_cedi, pi.precio_unitario, pi.costo_unitario_snapshot from pedidos p join pedido_items pi on pi.pedido_id=p.id where p.id='${pedidoId}'`)[0];
  ok('0 landing del distribuidor: el cliente paga el precio de la landing (409.900) y el costo del distribuidor es el precio mayorista efectivo', rw.success === true && Number(it0.precio_unitario) === 409900 && Number(it0.costo_unitario_snapshot) === Number(SQL(`select precio_mayorista_efectivo('${galon}') v`)[0].v) && it0.estado === 'por_confirmar' && it0.estado_cedi === null, JSON.stringify({ codigo, it0 }));
  // ---- 1) distribuidor jorge: confirma, NO puede despachar; inventario sin el costo de OZOAGRO; API no le entrega costo
  const pj = await login(browser, 'jorge', 'Jorge2026!!');
  const tkJ = await tokenDe(pj);
  const apiStar = await rest(tkJ, 'productos?select=*&limit=1'); const apiCols = await rest(tkJ, 'productos?select=id,nombre,precio_venta&limit=1'); const apiRpc = await (await fetch(BASE + '/rest/v1/rpc/productos_panel', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + tkJ, 'Content-Type': 'application/json' }, body: '{}' })).json();
  const galonRpc = (Array.isArray(apiRpc) ? apiRpc : []).find(x => x.id === galon) || {};
  ok('1a API como distribuidor: select * de productos falla (costo oculto), columnas públicas OK, productos_panel devuelve como costo el precio mayorista y sin precio_mayorista', apiStar.status >= 400 && apiCols.status === 200 && Number(galonRpc.costo_unitario) === Number(SQL(`select precio_mayorista_efectivo('${galon}') v`)[0].v) && galonRpc.precio_mayorista == null, JSON.stringify({ star: apiStar.status, cols: apiCols.status, galonRpc }));
  await modulo(pj, 'inventario'); let t = await txt(pj);
  ok('1b Inventario del distribuidor: "tu costo (mayorista)", sin "Editar" de producto y sin el costo de OZOAGRO (36.000/144.000)', /tu costo \(mayorista\)/.test(t) && !/Editar\s+\S*\s*(OZOAGRO 1 Litro|Galón)/.test(t) && !/\$\s?36\.000|\$\s?144\.000/.test(t) && (await pj.$$('#productos-cards button')).length === 0, t.slice(0, 200));
  await modulo(pj, 'pedidos'); await pj.waitForTimeout(2000);
  const rowSel = `tr:has-text("${codigo}")`;
  await pj.click(`${rowSel} button[title="Confirmar"]`); await pj.waitForTimeout(800); await pj.click('#accion-submit-btn'); await pj.waitForTimeout(2500);
  const s1 = SQL(`select estado, estado_cedi from pedidos where id='${pedidoId}'`)[0];
  ok('1c el distribuidor confirma → estado confirmado y estado_cedi por_pagar (trigger)', s1.estado === 'confirmado' && s1.estado_cedi === 'por_pagar', JSON.stringify(s1));
  await pj.click('text=Confirmados'); await pj.waitForTimeout(2500); t = await txt(pj);
  const despBtn = await pj.$(`${rowSel} button[title="Despachar"]`);
  ok('1d en Confirmados el distribuidor ve "Esperando a OZOAGRO (pago por confirmar)" y NO tiene botón Despachar', !despBtn && /Esperando a OZOAGRO/.test(t), (t.match(/.{0,40}Esperando.{0,60}/) || ['?'])[0]);
  const forzado = await (await fetch(BASE + '/rest/v1/pedidos?id=eq.' + pedidoId, { method: 'PATCH', headers: { apikey: ANON, Authorization: 'Bearer ' + tkJ, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'despachado', fecha_despachado: new Date().toISOString(), guia: 'FORZADA' }) }));
  const forzadoTxt = await forzado.text();
  ok('1e por API el distribuidor tampoco puede despachar antes del CEDI (el trigger lo rechaza)', forzado.status >= 400 && /OZOAGRO aún no ha despachado/.test(forzadoTxt) && SQL(`select estado from pedidos where id='${pedidoId}'`)[0].estado === 'confirmado', forzado.status + ' ' + forzadoTxt.slice(0, 120));
  // ---- 2) CEO: lo ve en Por confirmar › Distribuidores, confirma pago, despacha con guía; kardex
  const pc = await login(browser, 'ceo@ozoagro.co', 'Cucuta1234');
  await modulo(pc, 'pedidos'); await pc.waitForTimeout(1500); await pc.click('#subfiltro-distribuidores'); await pc.waitForTimeout(2500); t = await txt(pc);
  const rowCeo = await pc.$(rowSel);
  const rowTxt = rowCeo ? (await rowCeo.innerText()).replace(/\s+/g, ' ') : '';
  ok('2a CEO › Por confirmar › Distribuidores: aparece el pedido confirmado por jorge con "Pago por confirmar", valor mayorista y botón Confirmar pago; también los 2 confirmados viejos (OZO-12919, OZO-12921)', !!rowCeo && /Pago por confirmar/.test(rowTxt) && /Confirmar pago/.test(rowTxt) && /OZO-12919/.test(t) && /OZO-12921/.test(t), rowTxt.slice(0, 200));
  const stock0 = null;
  await pc.click(`${rowSel} button:has-text("Confirmar pago")`); await pc.waitForTimeout(3000);
  const s2 = SQL(`select estado, estado_cedi, fecha_cedi_pagado from pedidos where id='${pedidoId}'`)[0];
  ok('2b Confirmar pago → estado_cedi pagado (el pedido sale de Por confirmar › Distribuidores)', s2.estado_cedi === 'pagado' && !!s2.fecha_cedi_pagado && !(await pc.$(rowSel)), JSON.stringify(s2));
  await pc.click('text=Confirmados'); await pc.waitForTimeout(1500); await pc.click('#subfiltro-distribuidores'); await pc.waitForTimeout(2500);
  const rowC = await pc.$(rowSel); const rowCTxt = rowC ? (await rowC.innerText()).replace(/\s+/g, ' ') : '';
  ok('2c CEO › Confirmados › Distribuidores: "Pagado · por despachar" + botón Despachar al distribuidor', !!rowC && /Pagado/.test(rowCTxt) && /Despachar al distribuidor/.test(rowCTxt), rowCTxt.slice(0, 160));
  await pc.click(`${rowSel} button:has-text("Despachar al distribuidor")`); await pc.waitForTimeout(800); await pc.fill('#accion-guia', 'CEDI-QA-001'); await pc.fill('#accion-transportadora', 'Servientrega'); await pc.click('#accion-submit-btn'); await pc.waitForTimeout(3500);
  const s3 = SQL(`select estado, estado_cedi, guia_cedi, cedi_valor, cedi_costo from pedidos where id='${pedidoId}'`)[0];
  const inv = SQL(`select id, tipo, unidades, costo_unitario, coalesce(distribuidor_id::text,'CEO') d from inventario where nota like '%${codigo}%' order by tipo`);
  inv.forEach(r => invIds.push(r.id));
  ok('2d Despachar al distribuidor → estado_cedi despachado, guía, cedi_valor = precio mayorista (409.900 hoy) y cedi_costo = costo OZOAGRO (144.000); kardex: salida 4 L del CEO y entrada 4 L a jorge a 409.900', s3.estado_cedi === 'despachado' && s3.guia_cedi === 'CEDI-QA-001' && Number(s3.cedi_valor) === 409900 && Number(s3.cedi_costo) === 144000 && inv.length === 2 && inv.some(r => r.tipo === 'salida' && r.d === 'CEO' && Number(r.unidades) === 4) && inv.some(r => r.tipo === 'entrada' && r.d === jorgeId && Number(r.unidades) === 4 && Number(r.costo_unitario) === 409900 / 4), JSON.stringify({ s3, inv }));
  await pc.click('text=Despachados'); await pc.waitForTimeout(1500); await pc.click('#subfiltro-distribuidores'); await pc.waitForTimeout(2500);
  const rowD = await pc.$(rowSel); const rowDTxt = rowD ? (await rowD.innerText()).replace(/\s+/g, ' ') : '';
  ok('2e CEO › Despachados › Distribuidores: aparece con la guía del CEDI', !!rowD && /CEDI-QA-001/.test(rowDTxt), rowDTxt.slice(0, 160));
  // ---- 3) distribuidor ya puede despachar
  await pj.reload({ waitUntil: 'load' }); await pj.waitForTimeout(3000); await modulo(pj, 'pedidos'); await pj.waitForTimeout(1500); await pj.click('text=Confirmados'); await pj.waitForTimeout(2500);
  const despBtn2 = await pj.$(`${rowSel} button[title="Despachar"]`);
  ok('3a tras el despacho del CEDI, jorge ya ve el botón Despachar', !!despBtn2);
  if (despBtn2) { await despBtn2.click(); await pj.waitForTimeout(800); await pj.fill('#accion-guia', 'JORGE-QA-001'); await pj.click('#accion-submit-btn'); await pj.waitForTimeout(3000); }
  const s4 = SQL(`select estado, guia from pedidos where id='${pedidoId}'`)[0];
  ok('3b jorge despacha a su cliente → estado despachado', s4.estado === 'despachado' && s4.guia === 'JORGE-QA-001', JSON.stringify(s4));
  // ---- 4) precio mayorista: el CEO edita el galón desde Inventario (bug 2) y se guarda
  await modulo(pc, 'inventario'); await pc.waitForTimeout(2000);
  await pc.evaluate((id) => window.editarProducto(id), galon); await pc.waitForTimeout(800);
  await pc.fill('#edit-prod-mayorista', '300000'); await pc.click('#form-editar-producto button[type=submit]'); await pc.waitForTimeout(2500);
  const pm = SQL(`select precio_mayorista from productos where id='${galon}'`)[0].precio_mayorista;
  ok('4a CEO edita el precio mayorista del galón → 300.000 guardado (antes: error por columna inexistente)', Number(pm) === 300000, 'precio_mayorista=' + pm);
  t = await txt(pc);
  ok('4b la tarjeta del galón muestra "mayorista $ 300.000" al CEO', /mayorista\s*\$\s?300\.000/.test(t), (t.match(/.{0,30}mayorista.{0,30}/) || ['?'])[0]);
  const galonRpc2 = ((await (await fetch(BASE + '/rest/v1/rpc/productos_panel', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + tkJ, 'Content-Type': 'application/json' }, body: '{}' })).json()) || []).find(x => x.id === galon) || {};
  ok('4c para jorge el costo del galón pasa a ser 300.000 (precio mayorista)', Number(galonRpc2.costo_unitario) === 300000, JSON.stringify(galonRpc2));
  SQL(`update productos set precio_mayorista = null where id='${galon}'`);   // se deja como estaba: Jorge fija los suyos
  // ---- 5) Ventas y Balance del CEO: canal Mayorista con margen propio; Todos incluye el mayorista
  SQL(`update pedidos set es_test=false where id='${pedidoId}'`);   // solo para verlo en los KPIs; se vuelve a marcar abajo
  await modulo(pc, 'ventas'); await pc.waitForTimeout(2500); await pc.selectOption('#ventas-preset', 'today'); await pc.waitForTimeout(1500); await pc.selectOption('#ventas-canal', 'mayorista'); await pc.waitForTimeout(3000); t = await txt(pc); const tb = await txt(pc, '#ventas-tbody');
  const kpiVenta = await pc.evaluate(() => document.getElementById('kpi-venta').textContent), kpiRent = await pc.evaluate(() => document.getElementById('kpi-rentabilidad').textContent), kpiMargen = await pc.evaluate(() => (document.getElementById('kpi-dist-margen') || {}).textContent);
  const may = SQL("select set_config('request.jwt.claims','{\"sub\":\"" + SQL("select auth_user_id from admins limit 1")[0].auth_user_id + "\",\"role\":\"authenticated\"}',true); select venta_total, rentabilidad, num_pedidos from ventas_resumen(current_date, current_date, null, null, 'mayorista', null)")[0];
  const fmt = (n) => '$ ' + Math.round(Number(n)).toLocaleString('es-CO');
  ok('5a Ventas › canal Mayorista (hoy): los KPI del panel = ventas_resumen(mayorista) de hoy, incluye mi pedido (409.900 con margen 265.900) y la tabla lo muestra con el distribuidor', String(kpiVenta).replace(/\D/g, '') === String(Math.round(Number(may.venta_total))) && String(kpiRent).replace(/\D/g, '') === String(Math.round(Number(may.rentabilidad))) && Number(may.venta_total) >= 409900 && new RegExp(codigo).test(tb) && /jorge/i.test(tb) && tb.includes('265.900'), JSON.stringify({ may, kpiVenta, kpiRent, kpiMargen, tb: tb.slice(0, 500) }));
  const todos = SQL("select set_config('request.jwt.claims','{\"sub\":\"" + SQL("select auth_user_id from admins limit 1")[0].auth_user_id + "\",\"role\":\"authenticated\"}',true); select (select venta_total from ventas_resumen(current_date, current_date, null, null, null, null)) todos, (select venta_total from ventas_resumen(current_date, current_date, null, null, 'web', null)) + (select venta_total from ventas_resumen(current_date, current_date, null, null, 'tradicional', null)) + (select venta_total from ventas_resumen(current_date, current_date, null, null, 'agente', null)) + (select venta_total from ventas_resumen(current_date, current_date, null, null, 'mayorista', null)) suma")[0];
  ok('5b "Todos los canales" del CEO = web + tradicional + agente + mayorista', Number(todos.todos) === Number(todos.suma) && Number(todos.todos) >= 409900, JSON.stringify(todos));
  await modulo(pc, 'balance'); await pc.waitForTimeout(3000); t = await txt(pc);
  ok('5c Balance: fila "Mayorista (a distribuidores)" en Ventas por canal', /Mayorista \(a distribuidores\)/.test(t), (t.match(/Mayorista \(a distribuidores\).{0,60}/) || ['?'])[0]);
  const distV = SQL(`select subtotal, costo_total, rentabilidad from pedidos where id='${pedidoId}'`)[0];
  ok('5d para jorge el pedido vale 409.900 con costo = precio mayorista (409.900 hoy, margen 0) → su margen sale de lo que fije el CEO como mayorista', Number(distV.subtotal) === 409900 && Number(distV.costo_total) === 409900 && Number(distV.rentabilidad) === 0, JSON.stringify(distV));
  ok('6 sin errores JS (CEO y jorge)', pc._errs.length === 0 && pj._errs.length === 0, [pc._errs.join('|'), pj._errs.join('|')].filter(Boolean).join(' || '));
  await browser.close();
  // ---- limpieza: el pedido de prueba se CANCELA y queda es_test; los 2 movimientos de inventario de la prueba se retiran por id
  SQL(`update pedidos set es_test=true, estado='cancelado', fecha_cancelado=now(), motivo='prueba automática flujo CEDI' where id='${pedidoId}'`);
  if (invIds.length) SQL(`delete from inventario where id in (${invIds.map(x => `'${x}'`).join(',')})`);
  const fin = SQL(`select (select estado||'/'||es_test from pedidos where id='${pedidoId}') p, (select count(*) from inventario where nota like '%${codigo}%') inv`)[0];
  console.log(R.join('\n')); console.log('RESULTADO:', R.filter(x => x.startsWith('OK')).length + '/' + R.length, '· limpieza:', JSON.stringify(fin));
})().catch(e => { console.log(R.join('\n')); console.error('ERR', e.message.slice(0, 400)); if (pedidoId) { try { SQL(`update pedidos set es_test=true, estado='cancelado', fecha_cancelado=now(), motivo='prueba automática flujo CEDI (abortada)' where id='${pedidoId}' and estado<>'despachado'`); if (invIds.length) SQL(`delete from inventario where id in (${invIds.map(x => `'${x}'`).join(',')})`); } catch (_) {} } process.exit(1); });
