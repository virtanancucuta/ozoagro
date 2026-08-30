// OZOAGRO Panel - Modulo Balance
async function renderBalance(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Balance</h1>
        <div class="flex gap-2">
          <select id="balance-preset" class="px-3 py-2 border rounded-lg" onchange="loadBalanceData()">
            <option value="month" selected>Este mes</option>
            <option value="lastmonth">Mes anterior</option>
            <option value="7days">Ultimos 7 dias</option>
          </select>
          <select id="balance-canal" class="px-3 py-2 border rounded-lg" onchange="loadBalanceData()">
            <option value="">Todos los canales</option>
            <option value="web">Web</option>
            <option value="tradicional">Tradicional</option>
            <option value="agente">Agente</option>
          </select>
        </div>
      </div>

      <!-- KPIs principales -->
      <div class="grid md:grid-cols-5 gap-4">
        <div class="bg-white rounded-xl p-6 shadow">
          <div class="text-sm text-gray-500 mb-1">Litros Vendidos</div>
          <div id="bal-litros" class="text-3xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <div class="text-sm text-gray-500 mb-1">Venta Total</div>
          <div id="bal-venta" class="text-3xl font-bold text-primary">-</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <div class="text-sm text-gray-500 mb-1">Rentabilidad</div>
          <div id="bal-rentabilidad" class="text-3xl font-bold text-green-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <div class="text-sm text-gray-500 mb-1">Gastos</div>
          <div id="bal-gastos" class="text-3xl font-bold text-red-600">-</div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow border-2 border-primary">
          <div class="text-sm text-gray-500 mb-1">Utilidad</div>
          <div id="bal-utilidad" class="text-3xl font-bold">-</div>
        </div>
      </div>

      <!-- Comparativo -->
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Comparativo con Periodo Anterior</h2>
        <div id="comparativo" class="grid md:grid-cols-3 gap-6"></div>
      </div>

      <!-- Desglose -->
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl p-6 shadow">
          <h2 class="text-lg font-bold mb-4">Ventas por Canal</h2>
          <div id="ventas-por-canal" class="space-y-3"></div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <h2 class="text-lg font-bold mb-4">Ultimos Gastos</h2>
          <div id="ultimos-gastos" class="space-y-2"></div>
        </div>
      </div>
    </div>
  `;

  await loadBalanceData();
}

window.loadBalanceData = async function() {
  const preset = document.getElementById('balance-preset').value;
  const canal = document.getElementById('balance-canal').value;
  const range = getDateRange(preset);

  // Get balance via RPC
  const { data: balance } = await supabaseClient.rpc('balance_resumen', {
    p_fecha_ini: range.start,
    p_fecha_fin: range.end,
    p_canal: canal || null
  });

  if (balance && balance[0]) {
    const b = balance[0];
    document.getElementById('bal-litros').textContent = b.litros_vendidos || 0;
    document.getElementById('bal-venta').textContent = formatMoney(b.venta_total);
    document.getElementById('bal-rentabilidad').textContent = formatMoney(b.rentabilidad);
    document.getElementById('bal-gastos').textContent = formatMoney(b.gastos_total);

    const utilidad = b.utilidad || 0;
    const utilidadEl = document.getElementById('bal-utilidad');
    utilidadEl.textContent = formatMoney(utilidad);
    utilidadEl.className = `text-3xl font-bold ${utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`;
  }

  // Get previous period for comparison
  let prevRange;
  if (preset === 'month') {
    prevRange = getDateRange('lastmonth');
  } else if (preset === 'lastmonth') {
    const today = new Date();
    const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const twoMonthsAgoEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    prevRange = {
      start: twoMonthsAgo.toISOString().split('T')[0],
      end: twoMonthsAgoEnd.toISOString().split('T')[0]
    };
  } else {
    const week = new Date();
    week.setDate(week.getDate() - 14);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - 8);
    prevRange = {
      start: week.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    };
  }

  const { data: prevBalance } = await supabaseClient.rpc('balance_resumen', {
    p_fecha_ini: prevRange.start,
    p_fecha_fin: prevRange.end,
    p_canal: canal || null
  });

  // Show comparison
  const compContainer = document.getElementById('comparativo');
  if (balance && balance[0] && prevBalance && prevBalance[0]) {
    const curr = balance[0];
    const prev = prevBalance[0];

    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? '+100%' : '0%';
      const pct = ((curr - prev) / Math.abs(prev) * 100).toFixed(1);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    compContainer.innerHTML = `
      <div class="text-center">
        <div class="text-sm text-gray-500">Venta</div>
        <div class="text-xl font-bold">${formatMoney(curr.venta_total)}</div>
        <div class="text-sm ${curr.venta_total >= prev.venta_total ? 'text-green-600' : 'text-red-600'}">${calcChange(curr.venta_total, prev.venta_total)} vs anterior</div>
      </div>
      <div class="text-center">
        <div class="text-sm text-gray-500">Litros</div>
        <div class="text-xl font-bold">${curr.litros_vendidos}</div>
        <div class="text-sm ${curr.litros_vendidos >= prev.litros_vendidos ? 'text-green-600' : 'text-red-600'}">${calcChange(curr.litros_vendidos, prev.litros_vendidos)} vs anterior</div>
      </div>
      <div class="text-center">
        <div class="text-sm text-gray-500">Utilidad</div>
        <div class="text-xl font-bold ${curr.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}">${formatMoney(curr.utilidad)}</div>
        <div class="text-sm ${curr.utilidad >= prev.utilidad ? 'text-green-600' : 'text-red-600'}">${calcChange(curr.utilidad, prev.utilidad)} vs anterior</div>
      </div>
    `;
  } else {
    compContainer.innerHTML = '<p class="text-gray-500 col-span-3 text-center">Sin datos para comparar</p>';
  }

  // Ventas por canal
  const ventasCanalContainer = document.getElementById('ventas-por-canal');
  const canales = ['web', 'tradicional', 'agente'];
  let canalHtml = '';

  for (const c of canales) {
    const { data: canalData } = await supabaseClient.rpc('balance_resumen', {
      p_fecha_ini: range.start,
      p_fecha_fin: range.end,
      p_canal: c
    });
    if (canalData && canalData[0]) {
      const cd = canalData[0];
      canalHtml += `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="font-medium capitalize">${c}</span>
          <div class="text-right">
            <div class="font-bold">${formatMoney(cd.venta_total)}</div>
            <div class="text-xs text-gray-500">${cd.litros_vendidos || 0} litros</div>
          </div>
        </div>
      `;
    }
  }
  ventasCanalContainer.innerHTML = canalHtml || '<p class="text-gray-500">Sin ventas</p>';

  // Ultimos gastos
  const { data: gastos } = await supabaseClient.from('gastos').select('*').order('fecha', { ascending: false }).limit(5);
  const gastosContainer = document.getElementById('ultimos-gastos');

  if (gastos && gastos.length > 0) {
    gastosContainer.innerHTML = gastos.map(g => `
      <div class="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
        <div>
          <div class="font-medium text-sm">${g.descripcion}</div>
          <div class="text-xs text-gray-500">${formatDate(g.fecha)}</div>
        </div>
        <div class="font-medium text-red-600">${formatMoney(g.valor)}</div>
      </div>
    `).join('');
  } else {
    gastosContainer.innerHTML = '<p class="text-gray-500">Sin gastos registrados</p>';
  }
};
