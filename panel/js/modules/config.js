// OZOAGRO Panel - Modulo Configuracion
async function renderConfig(container) {
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
  const { data: config } = await supabase.from('config_negocio').select('*').limit(1).single();
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
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: existing } = await supabase.from('config_negocio').select('id').limit(1).single();

  let error;
  if (existing) {
    ({ error } = await supabase.from('config_negocio').update(data).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('config_negocio').insert(data));
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

  const { error } = await supabase.auth.updateUser({ password: newPass });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Contrasena actualizada');
  document.getElementById('form-cambiar-pass').reset();
}
