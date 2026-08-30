// OZOAGRO Panel - Modulo Ventas
async function renderVentas(container) {
  const range = getDateRange('month');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Ventas</h1>
        <div class="flex gap-2">
          <select id="ventas-preset" class="px-3 py-2 border rounded-lg" onchange="loadVentasData()">
            <option value="today">Hoy</option>
            <option value="7days">Ultimos 7 dias</option>
            <option value="month" selected>Este mes</option>
            <option value="lastmonth">Mes anterior</option>
          </select>
          <select id="ventas-canal" class="px-3 py-2 border rounded-lg" onchange="loadVentasData()">
            <option value="">Todos los canales</option>
            <option value="web">Web</option>
            <option value="tradicional">Tradicional</option>
            <option value="agente">Agente</option>
          </select>
        </div>
      </div>

      <!-- KPIs -->
      <div id="ventas-kpis" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

window.loadVentasData = async function() {
  const preset = document.getElementById('ventas-preset').value;
  const canal = document.getElementById('ventas-canal').value;
  const range = getDateRange(preset);

  // Get resumen via RPC
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
