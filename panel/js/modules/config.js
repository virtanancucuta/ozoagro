// OZOAGRO Panel - Modulo Configuracion
// Distribuidor: solo sus datos de contacto, el WhatsApp de su landing y el enlace. Los precios y la config del negocio son del CEO.
async function renderConfigDistribuidor(container) {
  const p = window.PERFIL || {};
  const landing = 'https://ozoagro.co/' + (p.slug || '');
  container.innerHTML = `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Configuracion</h1>
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-1">Tu landing</h2>
        <p class="text-sm text-gray-500 mb-3">Comparte este enlace: los pedidos que hagan ahi llegan a tu modulo Pedidos y el WhatsApp de la pagina es el tuyo.</p>
        <div class="flex flex-wrap gap-2 items-center">
          <a href="${landing}" target="_blank" class="font-mono text-primary underline break-all">${escapeHtml(landing)}</a>
          <button onclick="navigator.clipboard.writeText('${landing}').then(()=>showToast('Enlace copiado','success'))" class="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50">Copiar</button>
          <a href="https://wa.me/?text=${encodeURIComponent('Conoce OZOAGRO, proteccion natural para tus cultivos. Pide aqui con envio gratis y pago contra entrega: ' + landing)}" target="_blank" class="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50">Compartir por WhatsApp</a>
        </div>
      </div>
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Tus datos</h2>
        <form id="form-config-dist" class="space-y-4">
          <div class="grid md:grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium mb-1">Nombre</label><input type="text" value="${escapeHtml(p.nombre || '')}" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"></div>
            <div><label class="block text-sm font-medium mb-1">WhatsApp de tu landing *</label><input type="text" id="cfgd-whatsapp" required value="${escapeHtml(p.whatsapp || '')}" class="w-full px-3 py-2 border rounded-lg" placeholder="573001234567"><p class="text-xs text-gray-500 mt-1">Con indicativo 57. A este numero escriben tus clientes desde la landing.</p></div>
            <div><label class="block text-sm font-medium mb-1">Telefono</label><input type="text" id="cfgd-telefono" value="${escapeHtml(p.telefono || '')}" class="w-full px-3 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-1">Correo (recibe el aviso de cada pedido)</label><input type="email" id="cfgd-email" value="${escapeHtml(p.email || '')}" class="w-full px-3 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-1">Ciudad</label><input type="text" id="cfgd-ciudad" value="${escapeHtml(p.ciudad || '')}" class="w-full px-3 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-1">Departamento</label><input type="text" id="cfgd-departamento" value="${escapeHtml(p.departamento || '')}" class="w-full px-3 py-2 border rounded-lg"></div>
          </div>
          <button type="submit" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700">Guardar</button>
        </form>
      </div>
      <div class="bg-white rounded-xl p-6 shadow text-sm text-gray-600">
        <h2 class="text-lg font-bold mb-2 text-gray-800">Precios y productos</h2>
        <p>Los precios al detal de tu landing son los oficiales de OZOAGRO y los administra el CEO. Tu inventario, gastos, ventas y clientes son solo tuyos.</p>
      </div>
    </div>`;
  document.getElementById('form-config-dist').addEventListener('submit', async (e) => {
    e.preventDefault();
    let wa = document.getElementById('cfgd-whatsapp').value.replace(/\D/g, '');
    if (wa.length === 10 && wa.startsWith('3')) wa = '57' + wa;
    if (wa.length < 12) { showToast('WhatsApp invalido: usa el numero completo con 57', 'error'); return; }
    const cambios = { whatsapp: wa, telefono: document.getElementById('cfgd-telefono').value.replace(/\D/g, '') || null, email: document.getElementById('cfgd-email').value.trim().toLowerCase() || null, ciudad: document.getElementById('cfgd-ciudad').value.trim() || null, departamento: document.getElementById('cfgd-departamento').value.trim() || null };
    const { error } = await supabaseClient.from('distribuidores').update(cambios).eq('id', p.distribuidor_id);
    if (error) { showToast('Error guardando: ' + error.message, 'error'); return; }
    Object.assign(window.PERFIL, cambios);
    showToast('Datos guardados. Tu landing ya usa el nuevo WhatsApp.', 'success');
  });
}

async function renderConfig(container) {
  if (typeof esDistribuidor === 'function' && esDistribuidor()) return renderConfigDistribuidor(container);
  container.innerHTML = `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Configuracion</h1>

      <!-- Datos del negocio -->
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Datos del Negocio</h2>
        <form id="form-config-negocio" class="space-y-4">
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Nombre del negocio</label>
              <input type="text" id="cfg-nombre" class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Ciudad</label>
              <input type="text" id="cfg-ciudad" class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">WhatsApp del Agente</label>
              <input type="text" id="cfg-whatsapp-agente" class="w-full px-3 py-2 border rounded-lg" placeholder="573001234567">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">WhatsApp del CEO</label>
              <input type="text" id="cfg-whatsapp-ceo" class="w-full px-3 py-2 border rounded-lg" placeholder="573001234567">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Telegram Chat ID del CEO</label>
              <input type="text" id="cfg-telegram-ceo" class="w-full px-3 py-2 border rounded-lg" placeholder="123456789">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Email del CEO</label>
              <input type="email" id="cfg-email-ceo" class="w-full px-3 py-2 border rounded-lg">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Texto de confirmacion de pedido</label>
            <textarea id="cfg-texto-confirmacion" class="w-full px-3 py-2 border rounded-lg" rows="2"></textarea>
          </div>
          <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Guardar Configuracion</button>
        </form>
      </div>

      <!-- Cambiar contrasena -->
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Cambiar Contrasena</h2>
        <form id="form-cambiar-pass" class="space-y-4">
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Nueva contrasena</label>
              <input type="password" id="new-password" class="w-full px-3 py-2 border rounded-lg" minlength="6">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Confirmar contrasena</label>
              <input type="password" id="confirm-password" class="w-full px-3 py-2 border rounded-lg" minlength="6">
            </div>
          </div>
          <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Cambiar Contrasena</button>
        </form>
      </div>

      <!-- Info del sistema -->
      <div class="bg-gray-50 rounded-xl p-6">
        <h2 class="text-lg font-bold mb-4 text-gray-600">Informacion del Sistema</h2>
        <div class="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <strong>Usuario:</strong> <span id="info-email">-</span>
          </div>
          <div>
            <strong>Version:</strong> 1.0.0
          </div>
          <div>
            <strong>Proyecto Supabase:</strong> vlcxeajnucdkwamcivgy
          </div>
          <div>
            <strong>Region:</strong> us-east-2
          </div>
        </div>
      </div>
    </div>
  `;

  // Load current config
  await loadConfigData();

  // Form handlers
  document.getElementById('form-config-negocio').addEventListener('submit', handleSaveConfig);
  document.getElementById('form-cambiar-pass').addEventListener('submit', handleChangePassword);
}

async function loadConfigData() {
  // Load config
  const { data: config } = await supabaseClient.from('config_negocio').select('*').limit(1).single();
  if (config) {
    document.getElementById('cfg-nombre').value = config.nombre || '';
    document.getElementById('cfg-ciudad').value = config.ciudad || '';
    document.getElementById('cfg-whatsapp-agente').value = config.whatsapp_agente || '';
    document.getElementById('cfg-whatsapp-ceo').value = config.whatsapp_ceo || '';
    document.getElementById('cfg-telegram-ceo').value = config.telegram_chat_id_ceo || '';
    document.getElementById('cfg-email-ceo').value = config.email_ceo || '';
    document.getElementById('cfg-texto-confirmacion').value = config.texto_confirmacion || '';
  }

  // Show user email
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    document.getElementById('info-email').textContent = user.email;
  }
}

async function handleSaveConfig(e) {
  e.preventDefault();

  const data = {
    nombre: document.getElementById('cfg-nombre').value,
    ciudad: document.getElementById('cfg-ciudad').value,
    whatsapp_agente: document.getElementById('cfg-whatsapp-agente').value || null,
    whatsapp_ceo: document.getElementById('cfg-whatsapp-ceo').value || null,
    telegram_chat_id_ceo: document.getElementById('cfg-telegram-ceo').value || null,
    email_ceo: document.getElementById('cfg-email-ceo').value || null,
    texto_confirmacion: document.getElementById('cfg-texto-confirmacion').value || null,
    updated_at: new Date().toISOString()
  };

  // Get existing config id
  const { data: existing } = await supabaseClient.from('config_negocio').select('id').limit(1).single();

  let error;
  if (existing) {
    ({ error } = await supabaseClient.from('config_negocio').update(data).eq('id', existing.id));
  } else {
    ({ error } = await supabaseClient.from('config_negocio').insert(data));
  }

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Configuracion guardada');
}

async function handleChangePassword(e) {
  e.preventDefault();

  const newPass = document.getElementById('new-password').value;
  const confirmPass = document.getElementById('confirm-password').value;

  if (newPass !== confirmPass) {
    showToast('Las contrasenas no coinciden', 'error');
    return;
  }

  if (newPass.length < 6) {
    showToast('La contrasena debe tener al menos 6 caracteres', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: newPass });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Contrasena actualizada');
  document.getElementById('form-cambiar-pass').reset();
}
