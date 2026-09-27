// Panel OZOAGRO local (8799) contra BD real: login CEO -> Chats IA -> KPI/pestana/badge/modal de "Quiere ser distribuidor"
const { chromium } = require('C:/Users/Usuario/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright');
const S = __dirname;
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/Usuario/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8799/panel/', { waitUntil: 'networkidle' });
  ok((await page.content()).includes('chats.js?v=20260927a'), 'index.html carga chats.js?v=20260927a');
  await page.fill('#login-email', 'ceo@ozoagro.co');
  await page.fill('input[type="password"]', process.env.OZO_CEO_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-module="chats"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('[data-module="chats"]');
  await page.waitForSelector('#kpi-chats-dist', { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('kpi-chats-dist').textContent !== '-', null, { timeout: 30000 });
  const kpi = await page.textContent('#kpi-chats-dist');
  console.log('KPI quieren ser distribuidor =', kpi);
  ok(Number(kpi) >= 1, 'KPI "Quieren ser distribuidor" >= 1');
  await page.click('text=Quieren ser distribuidor >> nth=1').catch(async () => { await page.click('button:has-text("Quieren ser distribuidor")'); });
  await page.waitForTimeout(500);
  const filas = await page.$$eval('#chats-tbody tr', trs => trs.map(t => t.innerText));
  ok(filas.length >= 1 && filas.every(f => /Quiere ser distribuidor/.test(f)), 'pestana filtra solo interesados (' + filas.length + ' filas)');
  ok(filas.some(f => /Marta/.test(f)), 'aparece Marta Gómez (prueba senal)');
  await page.screenshot({ path: S + '/pw_chats_tab.png', fullPage: true });
  // modal
  await page.click('#chats-tbody tr:has-text("Marta") button:has-text("Ver chat")');
  await page.waitForSelector('#modal-ver-chat:not(.hidden)');
  await page.waitForTimeout(1500);
  const footer = await page.textContent('#chat-footer');
  ok(/Quiere ser distribuidor de OZOAGRO/.test(footer) && /almacén agrícola/.test(footer) && /Garzón/.test(footer), 'modal muestra negocio y zona');
  ok(/Crear distribuidor en el modulo Distribuidores/.test(footer), 'boton hacia Distribuidores');
  await page.screenshot({ path: S + '/pw_chats_modal.png', fullPage: true });
  await page.click('#chat-footer button:has-text("Crear distribuidor")');
  await page.waitForTimeout(1500);
  ok(/Distribuidores/.test(await page.textContent('#module-container')), 'salta al modulo Distribuidores');
  // excel: columnas nuevas presentes en la funcion
  ok(/Quiere ser distribuidor/.test(await page.evaluate(() => window.exportChatsExcel.toString())), 'Excel con columna nueva');
  // Todos: badge visible en cliente
  await page.click('[data-module="chats"]'); await page.waitForSelector('#kpi-chats-dist');
  await page.waitForFunction(() => document.getElementById('kpi-chats-dist').textContent !== '-', null, { timeout: 30000 });
  await page.click('button:has-text("Todos")'); await page.waitForTimeout(400);
  const badges = await page.$$eval('#chats-tbody span', ss => ss.filter(s => /Quiere ser distribuidor/.test(s.textContent)).length);
  ok(badges >= 1, 'badge morado en la tabla Todos (' + badges + ')');
  // movil
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390 + 2, 'sin scroll lateral en 390px (scrollWidth ' + sw + ')');
  await page.screenshot({ path: S + '/pw_chats_movil.png', fullPage: true });
  ok(errores.length === 0, 'sin errores JS (' + errores.join(' | ').slice(0, 300) + ')');
  await browser.close();
  console.log(fallos ? 'FALLOS: ' + fallos : 'TODO OK');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
