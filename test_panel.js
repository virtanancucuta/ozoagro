const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capturar errores de consola
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  try {
    await page.goto('https://ozoagro-ozoagro.pgnm3b.easypanel.host/panel/', { waitUntil: 'networkidle' });
    
    // Verificar estado inicial
    const loginVisible = await page.isVisible('#login-screen');
    console.log('Login screen visible:', loginVisible);
    
    // Intentar login
    await page.fill('#login-email', 'ceo@ozoagro.co');
    await page.fill('#login-password', 'OzoAgro2026!');
    await page.click('button[type="submit"]');
    
    // Esperar un poco
    await page.waitForTimeout(3000);
    
    // Verificar resultado
    const appVisible = await page.isVisible('#app-screen:not(.hidden)');
    const loginStillVisible = await page.isVisible('#login-screen:not(.hidden)');
    const errorVisible = await page.isVisible('#login-error:not(.hidden)');
    const errorText = errorVisible ? await page.textContent('#login-error') : 'N/A';
    
    console.log('App screen visible:', appVisible);
    console.log('Login still visible:', loginStillVisible);
    console.log('Error visible:', errorVisible, '-', errorText);
    console.log('JS Errors:', errors.length > 0 ? errors.join('; ') : 'None');
    
  } catch (e) {
    console.log('Error:', e.message);
    console.log('JS Errors:', errors.join('; '));
  }
  
  await browser.close();
})();
