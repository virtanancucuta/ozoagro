// OZOAGRO Panel - Modulo Gastos
async function renderGastos(container) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = today.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Gastos</h1>
        <button onclick="showAgregarGasto()" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Agregar Gasto
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex gap-4 items-center">
        <select id="gastos-mes" class="px-3 py-2 border rounded-lg" onchange="loadGastosData()">
          <option value="current">Este mes</option>
          <option value="last">Mes anterior</option>
          <option value="all">Todo</option>
        </select>
        <div id="gastos-total" class="ml-auto bg-white px-4 py-2 rounded-lg shadow">
          Total: <span class="font-bold text-red-600">$0</span>
        </div>
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripcion</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metodo</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody id="gastos-tbody" class="divide-y"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal Agregar -->
    <div id="modal-agregar-gasto" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Agregar Gasto</h2>
        <form id="form-agregar-gasto" class="space-y-4">
          <input type="hidden" id="gasto-id">
          <div>
            <label class="block text-sm font-medium mb-1">Descripcion *</label>
            <input type="text" id="gasto-descripcion" required class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Valor *</label>
              <input type="number" id="gasto-valor" required class="w-full px-3 py-2 border rounded-lg" min="0" step="100">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Fecha</label>
              <input type="date" id="gasto-fecha" class="w-full px-3 py-2 border rounded-lg" value="${monthEnd}">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Categoria</label>
              <input type="text" id="gasto-categoria" class="w-full px-3 py-2 border rounded-lg" placeholder="Ej: Transporte">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Metodo pago</label>
              <select id="gasto-metodo" class="w-full px-3 py-2 border rounded-lg">
                <option value="">Seleccionar</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Notas</label>
            <textarea id="gasto-notas" class="w-full px-3 py-2 border rounded-lg" rows="2"></textarea>
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-agregar-gasto')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadGastosData();
  document.getElementById('form-agregar-gasto').addEventListener('submit', handleGuardarGasto);
}

window.loadGastosData = async function() {
  const filtro = document.getElementById('gastos-mes').value;
  const today = new Date();

  let query = supabaseClient.from('gastos').select('*').order('fecha', { ascending: false });

  if (filtro === 'current') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    query = query.gte('fecha', start);
  } else if (filtro === 'last') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
    const end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
    query = query.gte('fecha', start).lte('fecha', end);
  }

  const { data: gastos } = await query;

  // Calculate total
  const total = gastos?.reduce((sum, g) => sum + parseFloat(g.valor), 0) || 0;
  document.getElementById('gastos-total').innerHTML = `Total: <span class="font-bold text-red-600">${formatMoney(total)}</span>`;

  const tbody = document.getElementById('gastos-tbody');
  if (!gastos || gastos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Sin gastos</td></tr>';
    return;
  }

  tbody.innerHTML = gastos.map(g => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm">${formatDate(g.fecha)}</td>
      <td class="px-4 py-3">${g.descripcion}</td>
      <td class="px-4 py-3 text-sm">${g.categoria || '-'}</td>
      <td class="px-4 py-3 text-sm">${g.metodo || '-'}</td>
      <td class="px-4 py-3 text-right font-medium text-red-600">${formatMoney(g.valor)}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="editarGasto('${g.id}')" class="text-blue-600 hover:underline text-sm mr-2">Editar</button>
        <button onclick="eliminarGasto('${g.id}')" class="text-red-600 hover:underline text-sm">Eliminar</button>
      </td>
    </tr>
  `).join('');
};

window.showAgregarGasto = function() {
  document.getElementById('gasto-id').value = '';
  document.getElementById('form-agregar-gasto').reset();
  document.getElementById('gasto-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-agregar-gasto').classList.remove('hidden');
};

window.editarGasto = async function(id) {
  const { data: gasto } = await supabaseClient.from('gastos').select('*').eq('id', id).single();
  if (!gasto) return;

  document.getElementById('gasto-id').value = id;
  document.getElementById('gasto-descripcion').value = gasto.descripcion;
  document.getElementById('gasto-valor').value = gasto.valor;
  document.getElementById('gasto-fecha').value = gasto.fecha;
  document.getElementById('gasto-categoria').value = gasto.categoria || '';
  document.getElementById('gasto-metodo').value = gasto.metodo || '';
  document.getElementById('gasto-notas').value = gasto.notas || '';
  document.getElementById('modal-agregar-gasto').classList.remove('hidden');
};

async function handleGuardarGasto(e) {
  e.preventDefault();
  const id = document.getElementById('gasto-id').value;

  const data = {
    descripcion: document.getElementById('gasto-descripcion').value,
    valor: parseFloat(document.getElementById('gasto-valor').value),
    fecha: document.getElementById('gasto-fecha').value,
    categoria: document.getElementById('gasto-categoria').value || null,
    metodo: document.getElementById('gasto-metodo').value || null,
    notas: document.getElementById('gasto-notas').value || null
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('gastos').update(data).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('gastos').insert(data));
  }

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast(id ? 'Gasto actualizado' : 'Gasto agregado');
  closeModal('modal-agregar-gasto');
  await loadGastosData();
}

window.eliminarGasto = async function(id) {
  if (!confirm('Eliminar este gasto?')) return;

  const { error } = await supabaseClient.from('gastos').delete().eq('id', id);
  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Gasto eliminado');
  await loadGastosData();
};
