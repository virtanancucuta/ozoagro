// OZOAGRO Panel - Modulo Ventas
async function renderVentas(container) {
  const range = getDateRange('month');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center flex-wrap gap-4">
        <h1 class="text-2xl font-bold text-gray-800">Ventas</h1>
        <div class="flex gap-2 flex-wrap items-center">
          <select id="ventas-preset" class="px-3 py-2 border rounded-lg" onchange="onPresetChange()">
            <option value="today">Hoy</option>
            <option value="7days">Ultimos 7 dias</option>
            <option value="month" selected>Este mes</option>
            <option value="lastmonth">Mes anterior</option>
            <option value="custom">Personalizado</option>
          </select>
          <div id="fechas-custom" class="hidden flex gap-2 items-center">
            <input type="date" id="ventas-fecha-ini" class="px-3 py-2 border rounded-lg" onchange="loadVentasData()">
            <span class="text-gray-500">a</span>
            <input type="date" id="ventas-fecha-fin" class="px-3 py-2 border rounded-lg" onchange="loadVentasData()">
          </div>
          <select id="ventas-canal" class="px-3 py-2 border rounded-lg" onchange="loadVentasData()">
            <option value="">Todos los canales</option>
            <option value="web">Web/Landing</option>
            <option value="tradicional">Tradicional</option>
            <option value="agente">Agente IA</option>
          </select>
        </div>
      </div>

      <!-- KPIs Generales -->
      <div id="ventas-kpis" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Litros Vendidos</div>
          <div id="kpi-litros" class="text-2xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Venta Total</div>
          <div id="kpi-venta" class="text-2xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Costo</div>
          <div id="kpi-costo" class="text-2xl font-bold text-gray-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Rentabilidad</div>
          <div id="kpi-rentabilidad" class="text-2xl font-bold text-green-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Rentabilidad %</div>
          <div id="kpi-rentabilidad-pct" class="text-2xl font-bold text-green-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-4 shadow">
          <div class="text-sm text-gray-500">Valor x Litro</div>
          <div id="kpi-valor-litro" class="text-2xl font-bold text-gold">-</div>
        </div>
      </div>

      <!-- KPIs por Canal -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-purple-600"></span>
            <span class="font-medium text-purple-800">Agente IA</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="text-gray-500">Litros:</span> <span id="kpi-agente-litros" class="font-bold">-</span></div>
            <div><span class="text-gray-500">Venta:</span> <span id="kpi-agente-venta" class="font-bold">-</span></div>
            <div class="col-span-2"><span class="text-gray-500">Tasa de cierre:</span> <span id="kpi-agente-tasa" class="font-bold text-purple-700">-</span></div>
          </div>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-blue-600"></span>
            <span class="font-medium text-blue-800">Web / Landing</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="text-gray-500">Litros:</span> <span id="kpi-web-litros" class="font-bold">-</span></div>
            <div><span class="text-gray-500">Venta:</span> <span id="kpi-web-venta" class="font-bold">-</span></div>
          </div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-gray-600"></span>
            <span class="font-medium text-gray-800">Tradicional</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="text-gray-500">Litros:</span> <span id="kpi-trad-litros" class="font-bold">-</span></div>
            <div><span class="text-gray-500">Venta:</span> <span id="kpi-trad-venta" class="font-bold">-</span></div>
          </div>
        </div>
      </div>

      <!-- Cobertura -->
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Cobertura de Stock</h2>
        <div id="cobertura-info" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div class="text-sm text-gray-500">Unidades en inventario</div>
            <div id="cob-unidades" class="text-xl font-bold">-</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Venta diaria proyectada</div>
            <div id="cob-venta-diaria" class="text-xl font-bold">-</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Dias de cobertura</div>
            <div id="cob-dias" class="text-xl font-bold text-primary">-</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Costo inventario</div>
            <div id="cob-costo" class="text-xl font-bold">-</div>
          </div>
        </div>
      </div>

      <!-- Tabla por dia -->
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <div class="px-6 py-4 border-b flex justify-between items-center">
          <h2 class="font-bold">Detalle por Pedido</h2>
          <button onclick="exportVentasCSV()" class="text-sm text-primary hover:underline">Exportar CSV</button>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codigo</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Litros</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Venta</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rentabilidad</th>
            </tr>
          </thead>
          <tbody id="ventas-tbody" class="divide-y"></tbody>
        </table>
      </div>
    </div>
  `;

  await loadVentasData();
}

window.onPresetChange = function() {
  const preset = document.getElementById('ventas-preset').value;
  const customDiv = document.getElementById('fechas-custom');
  if (preset === 'custom') {
    customDiv.classList.remove('hidden');
    customDiv.classList.add('flex');
    // Set default dates to this month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    document.getElementById('ventas-fecha-ini').value = firstDay;
    document.getElementById('ventas-fecha-fin').value = today;
  } else {
    customDiv.classList.add('hidden');
    customDiv.classList.remove('flex');
  }
  loadVentasData();
};

window.loadVentasData = async function() {
  const preset = document.getElementById('ventas-preset').value;
  const canal = document.getElementById('ventas-canal').value;

  let range;
  if (preset === 'custom') {
    range = {
      start: document.getElementById('ventas-fecha-ini').value,
      end: document.getElementById('ventas-fecha-fin').value
    };
    if (!range.start || !range.end) return;
  } else {
    range = getDateRange(preset);
  }

  // Get resumen via RPC (general o filtrado por canal)
  const { data: resumen } = await supabaseClient.rpc('ventas_resumen', {
    p_fecha_ini: range.start,
    p_fecha_fin: range.end,
    p_canal: canal || null
  });

  if (resumen && resumen[0]) {
    const r = resumen[0];
    document.getElementById('kpi-litros').textContent = r.litros_vendidos || 0;
    document.getElementById('kpi-venta').textContent = formatMoney(r.venta_total);
    document.getElementById('kpi-costo').textContent = formatMoney(r.costo_total);
    document.getElementById('kpi-rentabilidad').textContent = formatMoney(r.rentabilidad);
    document.getElementById('kpi-rentabilidad-pct').textContent = (r.rentabilidad_pct || 0) + '%';
    document.getElementById('kpi-valor-litro').textContent = formatMoney(r.valor_promedio_litro);
  }

  // Get KPIs por canal (siempre, para mostrar el desglose)
  await loadKpisPorCanal(range);

  // Get cobertura
  const { data: cobertura } = await supabaseClient.rpc('cobertura_stock');
  if (cobertura && cobertura[0]) {
    const c = cobertura[0];
    document.getElementById('cob-unidades').textContent = c.unidades_disponibles || 0;
    document.getElementById('cob-venta-diaria').textContent = (c.venta_diaria_proyectada || 0) + ' L/dia';
    document.getElementById('cob-dias').textContent = c.cobertura_dias ? c.cobertura_dias + ' dias' : (c.mensaje || '-');
    document.getElementById('cob-costo').textContent = formatMoney(c.costo_inventario);
  }

  // Get pedidos detail
  let query = supabaseClient
    .from('pedidos')
    .select('*, cliente:clientes(nombre), items:pedido_items(litros, cantidad)')
    .in('estado', ['despachado', 'cerrado'])
    .eq('es_test', false)
    .gte('created_at', range.start)
    .lte('created_at', range.end + 'T23:59:59')
    .order('created_at', { ascending: false });

  if (canal) query = query.eq('canal', canal);

  const { data: pedidos } = await query;

  const tbody = document.getElementById('ventas-tbody');
  if (!pedidos || pedidos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">Sin ventas en este periodo</td></tr>';
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
    const litros = p.items?.reduce((sum, i) => sum + (i.litros * i.cantidad), 0) || 0;
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-mono text-sm">${p.codigo_publico}</td>
        <td class="px-4 py-3 text-sm">${formatDate(p.fecha_despachado || p.created_at)}</td>
        <td class="px-4 py-3">${p.cliente?.nombre || '-'}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${p.canal === 'web' ? 'bg-blue-100 text-blue-700' : p.canal === 'agente' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}">${p.canal}</span></td>
        <td class="px-4 py-3 text-right">${litros}</td>
        <td class="px-4 py-3 text-right font-medium">${formatMoney(p.subtotal)}</td>
        <td class="px-4 py-3 text-right ${p.rentabilidad < 0 ? 'text-red-600' : 'text-green-600'}">${formatMoney(p.rentabilidad)}</td>
      </tr>
    `;
  }).join('');
};

async function loadKpisPorCanal(range) {
  // Agente IA
  const { data: resAgente } = await supabaseClient.rpc('ventas_resumen', {
    p_fecha_ini: range.start, p_fecha_fin: range.end, p_canal: 'agente'
  });
  if (resAgente && resAgente[0]) {
    document.getElementById('kpi-agente-litros').textContent = resAgente[0].litros_vendidos || 0;
    document.getElementById('kpi-agente-venta').textContent = formatMoney(resAgente[0].venta_total);
  } else {
    document.getElementById('kpi-agente-litros').textContent = '0';
    document.getElementById('kpi-agente-venta').textContent = '$0';
  }

  // Web
  const { data: resWeb } = await supabaseClient.rpc('ventas_resumen', {
    p_fecha_ini: range.start, p_fecha_fin: range.end, p_canal: 'web'
  });
  if (resWeb && resWeb[0]) {
    document.getElementById('kpi-web-litros').textContent = resWeb[0].litros_vendidos || 0;
    document.getElementById('kpi-web-venta').textContent = formatMoney(resWeb[0].venta_total);
  } else {
    document.getElementById('kpi-web-litros').textContent = '0';
    document.getElementById('kpi-web-venta').textContent = '$0';
  }

  // Tradicional
  const { data: resTrad } = await supabaseClient.rpc('ventas_resumen', {
    p_fecha_ini: range.start, p_fecha_fin: range.end, p_canal: 'tradicional'
  });
  if (resTrad && resTrad[0]) {
    document.getElementById('kpi-trad-litros').textContent = resTrad[0].litros_vendidos || 0;
    document.getElementById('kpi-trad-venta').textContent = formatMoney(resTrad[0].venta_total);
  } else {
    document.getElementById('kpi-trad-litros').textContent = '0';
    document.getElementById('kpi-trad-venta').textContent = '$0';
  }

  // Tasa de cierre del agente = pedidos cerrados / conversaciones unicas
  const { data: pedidosAgente } = await supabaseClient
    .from('pedidos')
    .select('id')
    .eq('canal', 'agente')
    .in('estado', ['despachado', 'cerrado'])
    .eq('es_test', false)
    .gte('created_at', range.start)
    .lte('created_at', range.end + 'T23:59:59');

  const { data: conversaciones } = await supabaseClient
    .from('wa_conversaciones')
    .select('id')
    .gte('created_at', range.start)
    .lte('created_at', range.end + 'T23:59:59');

  const numPedidos = pedidosAgente?.length || 0;
  const numConvs = conversaciones?.length || 0;
  const tasa = numConvs > 0 ? Math.round((numPedidos / numConvs) * 100) : 0;

  document.getElementById('kpi-agente-tasa').textContent = `${tasa}% (${numPedidos}/${numConvs})`;
}

window.exportVentasCSV = function() {
  const rows = document.querySelectorAll('#ventas-tbody tr');
  let csv = 'Codigo,Fecha,Cliente,Canal,Litros,Venta,Rentabilidad\n';
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 7) {
      csv += Array.from(cells).map(c => '"' + c.textContent.trim().replace(/"/g, '""') + '"').join(',') + '\n';
    }
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ventas_ozoagro.csv';
  a.click();
};
