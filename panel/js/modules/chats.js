// OZOAGRO Panel - Modulo Chats IA (conversaciones del agente Andres por WhatsApp)
// Fuente: RPC chats_ia_resumen() (wa_conversaciones + wa_mensajes + pedidos por telefono)
let chatsTab = 'sin_conversion';
let chatsData = [];
let chatsBusqueda = '';

async function renderChats(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Chats IA</h1>
          <p class="text-sm text-gray-500">Conversaciones atendidas por Andres (agente de WhatsApp). Usa "Sin conversion" para remarketing.</p>
        </div>
        <button onclick="exportChatsExcel()" class="bg-primary text-white px-3 py-1 rounded-lg hover:bg-green-700 text-sm flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Exportar Excel
        </button>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Chats atendidos</div>
          <div id="kpi-chats-total" class="text-2xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Con conversion (pedido)</div>
          <div id="kpi-chats-con" class="text-2xl font-bold text-green-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Sin conversion (remarketing)</div>
          <div id="kpi-chats-sin" class="text-2xl font-bold text-orange-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Tasa de cierre</div>
          <div id="kpi-chats-tasa" class="text-2xl font-bold text-gray-700">-</div>
        </div>
      </div>

      <!-- Tabs + busqueda -->
      <div class="flex flex-wrap justify-between items-end gap-3 border-b">
        <div class="flex gap-4">
          <button onclick="setChatsTab('sin_conversion')" class="tab-btn ${chatsTab === 'sin_conversion' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Sin conversion</button>
          <button onclick="setChatsTab('con_conversion')" class="tab-btn ${chatsTab === 'con_conversion' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Con conversion</button>
          <button onclick="setChatsTab('todos')" class="tab-btn ${chatsTab === 'todos' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Todos</button>
        </div>
        <input id="chats-buscar" type="text" placeholder="Buscar nombre, telefono, ciudad o cultivo" class="mb-2 px-3 py-2 border rounded-lg w-72 text-sm" oninput="filtrarChats(this.value)">
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded-xl shadow overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cultivo</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ultimo mensaje</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Msgs</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody id="chats-tbody" class="divide-y">
            <tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal ver chat -->
    <div id="modal-ver-chat" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="p-4 border-b flex justify-between items-start">
          <div>
            <h2 id="chat-titulo" class="text-lg font-bold">Conversacion</h2>
            <p id="chat-subtitulo" class="text-sm text-gray-500"></p>
          </div>
          <button onclick="closeModal('modal-ver-chat')" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div id="chat-mensajes" class="p-4 overflow-y-auto space-y-2 bg-gray-50 flex-1" style="min-height:240px"></div>
        <div id="chat-footer" class="p-4 border-t flex justify-between items-center gap-3 text-sm"></div>
      </div>
    </div>
  `;

  await loadChatsData();
}

async function loadChatsData() {
  const { data, error } = await supabaseClient.rpc('chats_ia_resumen');
  if (error) {
    showToast('Error cargando chats: ' + error.message, 'error');
    document.getElementById('chats-tbody').innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-red-600">Error: ' + escapeHtml(error.message) + '</td></tr>';
    return;
  }
  chatsData = data || [];

  const total = chatsData.length;
  const con = chatsData.filter(c => c.tiene_pedido).length;
  document.getElementById('kpi-chats-total').textContent = total;
  document.getElementById('kpi-chats-con').textContent = con;
  document.getElementById('kpi-chats-sin').textContent = total - con;
  document.getElementById('kpi-chats-tasa').textContent = total ? Math.round(con * 100 / total) + '%' : '-';

  renderChatsTable();
}

function chatsFiltrados() {
  let rows = chatsData;
  if (chatsTab === 'sin_conversion') rows = rows.filter(c => !c.tiene_pedido);
  if (chatsTab === 'con_conversion') rows = rows.filter(c => c.tiene_pedido);
  const q = chatsBusqueda.trim().toLowerCase();
  if (q) {
    rows = rows.filter(c => [c.nombre, c.telefono, c.ciudad, c.departamento, c.cultivo].some(v => String(v || '').toLowerCase().includes(q)));
  }
  return rows;
}

function estadoPedidoBadge(estado) {
  const map = {
    por_confirmar: 'bg-yellow-100 text-yellow-800', confirmado: 'bg-blue-100 text-blue-700',
    despachado: 'bg-indigo-100 text-indigo-700', cerrado: 'bg-green-100 text-green-700',
    devuelto: 'bg-orange-100 text-orange-700', cancelado: 'bg-red-100 text-red-700'
  };
  return `<span class="px-2 py-0.5 text-xs rounded-full ${map[estado] || 'bg-gray-100 text-gray-700'}">${escapeHtml((estado || '').replace('_', ' '))}</span>`;
}

function renderChatsTable() {
  const tbody = document.getElementById('chats-tbody');
  const rows = chatsFiltrados();
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Sin chats en esta vista</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(c => `
    <tr class="hover:bg-gray-50 ${c.contactado ? 'opacity-60' : ''}">
      <td class="px-4 py-3">
        <div class="font-medium">${escapeHtml(c.nombre || 'Sin nombre')}</div>
        <div class="text-xs text-gray-500">${c.contactado ? 'Contactado (remarketing)' : ''}</div>
      </td>
      <td class="px-4 py-3 text-sm">${escapeHtml(c.telefono)}</td>
      <td class="px-4 py-3 text-sm">${escapeHtml(c.ciudad || '-')}${c.departamento ? '<div class="text-xs text-gray-500">' + escapeHtml(c.departamento) + '</div>' : ''}</td>
      <td class="px-4 py-3 text-sm">${escapeHtml(c.cultivo || '-')}</td>
      <td class="px-4 py-3 text-sm">
        <div>${formatDateTime(c.ultimo_mensaje)}</div>
        <div class="text-xs text-gray-500 truncate max-w-[220px]" title="${escapeHtml(c.ultimo_texto || '')}">${escapeHtml((c.ultimo_texto || '').slice(0, 60))}</div>
      </td>
      <td class="px-4 py-3 text-center text-sm">${c.n_mensajes}</td>
      <td class="px-4 py-3 text-sm">
        ${c.tiene_pedido ? `<div class="font-mono">${escapeHtml(c.pedido_codigo)}</div>${estadoPedidoBadge(c.pedido_estado)}<div class="text-xs text-gray-500">${formatMoney(c.pedido_total)}</div>` : '<span class="text-orange-600 text-xs font-medium">Sin pedido</span>'}
      </td>
      <td class="px-4 py-3">
        <div class="flex justify-center items-center gap-2">
          <button onclick="verChat('${c.conversacion_id}')" class="text-primary hover:underline text-sm">Ver chat</button>
          <a href="${waLink(c.telefono)}" target="_blank" class="text-green-600 hover:underline text-sm">WhatsApp</a>
          ${!c.tiene_pedido ? `<button onclick="marcarChatContactado('${c.conversacion_id}', ${c.contactado ? 'false' : 'true'})" class="text-gray-600 hover:underline text-sm">${c.contactado ? 'Desmarcar' : 'Contactado'}</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

window.setChatsTab = function(tab) {
  chatsTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`[onclick="setChatsTab('${tab}')"]`);
  if (btn) btn.classList.add('active');
  renderChatsTable();
};

window.filtrarChats = function(valor) {
  chatsBusqueda = valor || '';
  renderChatsTable();
};

window.verChat = async function(conversacionId) {
  const c = chatsData.find(x => x.conversacion_id === conversacionId);
  if (!c) return;
  document.getElementById('chat-titulo').textContent = c.nombre || 'Sin nombre';
  document.getElementById('chat-subtitulo').textContent = [c.telefono, c.ciudad, c.departamento, c.cultivo].filter(Boolean).join(' · ');
  const box = document.getElementById('chat-mensajes');
  box.innerHTML = '<div class="text-center text-gray-500 py-6">Cargando conversacion...</div>';
  document.getElementById('modal-ver-chat').classList.remove('hidden');

  const { data: msgs, error } = await supabaseClient
    .from('wa_mensajes')
    .select('rol, contenido, created_at')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    box.innerHTML = '<div class="text-red-600 text-center py-6">Error: ' + escapeHtml(error.message) + '</div>';
    return;
  }
  if (!msgs || msgs.length === 0) {
    box.innerHTML = '<div class="text-gray-500 text-center py-6">Sin mensajes</div>';
  } else {
    box.innerHTML = msgs.map(m => {
      const esBot = m.rol === 'assistant';
      return `
        <div class="flex ${esBot ? 'justify-start' : 'justify-end'}">
          <div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${esBot ? 'bg-white text-gray-800 rounded-tl-sm' : 'bg-green-100 text-gray-900 rounded-tr-sm'}">
            <div class="text-[10px] uppercase tracking-wide ${esBot ? 'text-primary' : 'text-green-700'} mb-0.5">${esBot ? 'Andres (IA)' : 'Cliente'}</div>
            <div class="whitespace-pre-wrap break-words">${escapeHtml(m.contenido)}</div>
            <div class="text-[10px] text-gray-400 mt-1 text-right">${formatDateTime(m.created_at)}</div>
          </div>
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  document.getElementById('chat-footer').innerHTML = `
    <div>${c.tiene_pedido ? `Pedido <span class="font-mono">${escapeHtml(c.pedido_codigo)}</span> ${estadoPedidoBadge(c.pedido_estado)} ${formatMoney(c.pedido_total)}` : '<span class="text-orange-600 font-medium">Sin pedido: candidato a remarketing</span>'}</div>
    <a href="${waLink(c.telefono, 'Hola ' + (c.nombre ? c.nombre.split(' ')[0] : '') + ', le escribe OZOAGRO')}" target="_blank" class="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">Escribir por WhatsApp</a>
  `;
};

window.marcarChatContactado = async function(conversacionId, contactado) {
  const { error } = await supabaseClient.rpc('chats_ia_marcar', { p_conversacion_id: conversacionId, p_contactado: contactado, p_nota: null });
  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }
  showToast(contactado ? 'Chat marcado como contactado' : 'Marca retirada');
  await loadChatsData();
};

window.exportChatsExcel = function() {
  const rows = chatsFiltrados().map(c => ({
    'Nombre': c.nombre || '',
    'Telefono': c.telefono || '',
    'Ciudad': c.ciudad || '',
    'Departamento': c.departamento || '',
    'Cultivo': c.cultivo || '',
    'Inicio chat': c.inicio ? formatDateTime(c.inicio) : '',
    'Ultimo mensaje': c.ultimo_mensaje ? formatDateTime(c.ultimo_mensaje) : '',
    'Mensajes': c.n_mensajes || 0,
    'Conversion': c.tiene_pedido ? 'SI' : 'NO',
    'Pedido': c.pedido_codigo || '',
    'Estado pedido': c.pedido_estado || '',
    'Valor pedido': c.pedido_total || 0,
    'Contactado remarketing': c.contactado ? 'SI' : 'NO'
  }));
  if (rows.length === 0) {
    showToast('No hay chats para exportar', 'error');
    return;
  }
  const generar = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chats IA');
    ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }));
    XLSX.writeFile(wb, `chats_ia_${chatsTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Excel descargado');
  };
  if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = generar;
    document.head.appendChild(script);
  } else {
    generar();
  }
};
