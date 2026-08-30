// OZOAGRO Panel - Modulo CRM
let crmTab = 'por_contactar';

async function renderCrm(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">CRM - Clientes</h1>
        <button onclick="exportClientesExcel()" class="bg-primary text-white px-3 py-1 rounded-lg hover:bg-green-700 text-sm flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Exportar Excel
        </button>
      </div>

      <!-- KPIs -->
      <div id="crm-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Visitas Hoy</div>
          <div id="kpi-visitas-hoy" class="text-2xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">De Pauta Hoy</div>
          <div id="kpi-pauta-hoy" class="text-2xl font-bold text-blue-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Visitas 7 Dias</div>
          <div id="kpi-visitas-7" class="text-2xl font-bold text-gray-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Carritos Abandonados</div>
          <div id="kpi-carritos" class="text-2xl font-bold text-orange-600">-</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="border-b flex gap-4">
        <button onclick="setCrmTab('por_contactar')" class="tab-btn ${crmTab === 'por_contactar' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Por Contactar</button>
        <button onclick="setCrmTab('atendidos')" class="tab-btn ${crmTab === 'atendidos' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Atendidos</button>
        <button onclick="setCrmTab('carritos')" class="tab-btn ${crmTab === 'carritos' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Carritos Abandonados</button>
        <button onclick="setCrmTab('todos')" class="tab-btn ${crmTab === 'todos' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Base de Datos</button>
      </div>

      <!-- Filtros (solo para todos) -->
      <div id="crm-filtros" class="${crmTab === 'todos' ? '' : 'hidden'} flex gap-4 items-center">
        <select id="crm-tipo" class="px-3 py-2 border rounded-lg" onchange="loadCrmData()">
          <option value="">Todos los tipos</option>
          <option value="generico">Generico</option>
          <option value="distribuidor">Distribuidor</option>
        </select>
        <select id="crm-orden" class="px-3 py-2 border rounded-lg" onchange="loadCrmData()">
          <option value="mayor_compra">Mayor compra</option>
          <option value="mas_dias_sin_comprar">Mas dias sin comprar</option>
          <option value="menos_dias_sin_comprar">Menos dias sin comprar</option>
        </select>
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr id="crm-thead"></tr>
          </thead>
          <tbody id="crm-tbody" class="divide-y"></tbody>
        </table>
      </div>
    </div>
  `;

  await loadCrmKpis();
  await loadCrmData();
}

async function loadCrmKpis() {
  const { data } = await supabaseClient.rpc('crm_visitas');
  if (data && data[0]) {
    document.getElementById('kpi-visitas-hoy').textContent = data[0].visitas_hoy || 0;
    document.getElementById('kpi-pauta-hoy').textContent = data[0].visitas_pauta_hoy || 0;
    document.getElementById('kpi-visitas-7').textContent = data[0].visitas_7_dias || 0;
    document.getElementById('kpi-carritos').textContent = data[0].carritos_7_dias || 0;
  }
}

window.setCrmTab = function(tab) {
  crmTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[onclick="setCrmTab('${tab}')"]`).classList.add('active');
  document.getElementById('crm-filtros').classList.toggle('hidden', tab !== 'todos');
  loadCrmData();
};

window.loadCrmData = async function() {
  const thead = document.getElementById('crm-thead');
  const tbody = document.getElementById('crm-tbody');

  switch (crmTab) {
    case 'por_contactar':
      thead.innerHTML = `
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
      `;

      const { data: porContactar } = await supabaseClient
        .from('pedidos')
        .select('*, cliente:clientes(*)')
        .eq('estado', 'por_confirmar')
        .eq('es_test', false)
        .order('created_at', { ascending: false });

      if (!porContactar || porContactar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Sin clientes por contactar</td></tr>';
        return;
      }

      tbody.innerHTML = porContactar.map(p => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-medium">${p.cliente?.nombre || '-'}</td>
          <td class="px-4 py-3">${p.cliente?.telefono || '-'}</td>
          <td class="px-4 py-3">${p.ciudad_envio || '-'}</td>
          <td class="px-4 py-3 font-mono text-sm">${p.codigo_publico}</td>
          <td class="px-4 py-3 text-sm">${formatDateTime(p.created_at)}</td>
          <td class="px-4 py-3 text-center">
            ${p.cliente?.telefono ? `<a href="https://wa.me/57${p.cliente.telefono.replace(/\\D/g,'')}" target="_blank" class="inline-flex items-center gap-1 text-green-600 hover:underline text-sm mr-3"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>` : ''}
            <button onclick="marcarAtendido('${p.cliente?.id}')" class="text-primary hover:underline text-sm">Ya contacte</button>
          </td>
        </tr>
      `).join('');
      break;

    case 'atendidos':
      thead.innerHTML = `
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cultivo</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Comprado</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ultima Compra</th>
      `;

      const { data: atendidos } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('estado_crm', 'atendido')
        .order('ultima_compra_fecha', { ascending: false });

      if (!atendidos || atendidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">Sin clientes atendidos</td></tr>';
        return;
      }

      tbody.innerHTML = atendidos.map(c => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-medium">${c.nombre}</td>
          <td class="px-4 py-3">${c.telefono || '-'}</td>
          <td class="px-4 py-3">${c.cultivo || '-'}</td>
          <td class="px-4 py-3 text-right font-medium">${formatMoney(c.total_comprado_valor)}</td>
          <td class="px-4 py-3 text-sm">${formatDate(c.ultima_compra_fecha)}</td>
        </tr>
      `).join('');
      break;

    case 'carritos':
      thead.innerHTML = `
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
      `;

      const { data: carritos } = await supabaseClient
        .from('checkouts_abandonados')
        .select('*, producto:productos(nombre)')
        .eq('contactado', false)
        .order('created_at', { ascending: false });

      if (!carritos || carritos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">Sin carritos abandonados</td></tr>';
        return;
      }

      tbody.innerHTML = carritos.map(c => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-medium">${c.nombre || '-'}</td>
          <td class="px-4 py-3">${c.telefono || '-'}</td>
          <td class="px-4 py-3">${c.ciudad || '-'}</td>
          <td class="px-4 py-3 text-sm">${formatDateTime(c.created_at)}</td>
          <td class="px-4 py-3 text-center">
            ${c.telefono ? `<a href="https://wa.me/57${c.telefono.replace(/\\D/g,'')}" target="_blank" class="inline-flex items-center gap-1 text-green-600 hover:underline text-sm"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>` : '-'}
          </td>
        </tr>
      `).join('');
      break;

    case 'todos':
      thead.innerHTML = `
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cultivo</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (L)</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total ($)</th>
        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dias sin comprar</th>
      `;

      const tipo = document.getElementById('crm-tipo').value || null;
      const orden = document.getElementById('crm-orden').value;

      const { data: clientes } = await supabaseClient.rpc('crm_clientes', { p_tipo: tipo, p_orden: orden });

      if (!clientes || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Sin clientes</td></tr>';
        return;
      }

      tbody.innerHTML = clientes.map(c => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-medium">${c.nombre}</td>
          <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${c.tipo === 'distribuidor' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}">${c.tipo}</span></td>
          <td class="px-4 py-3">${c.telefono || '-'}</td>
          <td class="px-4 py-3">${c.ciudad || '-'}</td>
          <td class="px-4 py-3">${c.cultivo || '-'}</td>
          <td class="px-4 py-3 text-right">${c.total_litros || 0}</td>
          <td class="px-4 py-3 text-right font-medium">${formatMoney(c.total_valor)}</td>
          <td class="px-4 py-3 text-right ${c.dias_sin_comprar > 30 ? 'text-red-600' : ''}">${c.dias_sin_comprar ?? '-'}</td>
        </tr>
      `).join('');
      break;
  }
};

window.marcarAtendido = async function(clienteId) {
  if (!clienteId) return;
  const { error } = await supabaseClient.from('clientes').update({ estado_crm: 'atendido' }).eq('id', clienteId);
  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }
  showToast('Cliente marcado como atendido');
  await loadCrmData();
};

window.exportClientesExcel = async function() {
  const { data } = await supabaseClient.from('clientes').select('*').order('nombre');
  if (!data || data.length === 0) {
    showToast('No hay clientes para exportar', 'error');
    return;
  }

  // Preparar datos para Excel
  const rows = data.map(c => ({
    'Nombre': c.nombre || '',
    'Tipo': c.tipo || '',
    'Cedula': c.cedula || '',
    'Telefono': c.telefono || '',
    'Email': c.email || '',
    'Ciudad': c.ciudad || '',
    'Departamento': c.departamento || '',
    'Cultivo': c.cultivo || '',
    'Origen': c.origen || '',
    'Total Litros': c.total_comprado_litros || 0,
    'Total Valor': c.total_comprado_valor || 0,
    'Dias sin comprar': c.dias_sin_comprar || '',
    'Estado CRM': c.estado_crm || ''
  }));

  // Usar SheetJS
  if (typeof XLSX === 'undefined') {
    showToast('Cargando libreria Excel...', 'info');
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = () => generateExcel(rows);
    document.head.appendChild(script);
  } else {
    generateExcel(rows);
  }
};

function generateExcel(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

  // Ajustar anchos de columna
  const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
  ws['!cols'] = colWidths;

  // Generar archivo
  const fecha = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `clientes_ozoagro_${fecha}.xlsx`);
  showToast('Excel descargado');
}
