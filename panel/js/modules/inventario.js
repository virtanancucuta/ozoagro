// OZOAGRO Panel - Modulo Inventario
async function renderInventario(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Inventario</h1>
        <button onclick="showAgregarInventario()" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Agregar Inventario
        </button>
      </div>

      <!-- Productos -->
      <div id="productos-cards" class="grid grid-cols-1 sm:grid-cols-3 gap-3"></div>

      <!-- Cobertura Card -->
      <div class="bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-4">Cobertura de Stock</h2>
        <div id="cobertura-inventario" class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>
        <p class="text-sm text-gray-500 mt-4">Formula: Con X unidades y una venta de Y L/dia tienes Z dias de producto</p>
      </div>

      <!-- Historial -->
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <div class="px-6 py-4 border-b">
          <h2 class="font-bold">Movimientos de Inventario</h2>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unitario</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nota</th>
            </tr>
          </thead>
          <tbody id="inventario-tbody" class="divide-y"></tbody>
        </table>
      </div>
    </div>

    <!-- Modal Agregar -->
    <div id="modal-agregar-inventario" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Agregar Inventario</h2>
        <form id="form-agregar-inventario" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Unidades (litros)</label>
            <input type="number" id="inv-unidades" required class="w-full px-3 py-2 border rounded-lg" min="1">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Costo Unitario</label>
            <input type="number" id="inv-costo" required class="w-full px-3 py-2 border rounded-lg" min="0" step="100">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tipo</label>
            <select id="inv-tipo" class="w-full px-3 py-2 border rounded-lg">
              <option value="entrada">Entrada</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Nota</label>
            <input type="text" id="inv-nota" class="w-full px-3 py-2 border rounded-lg" placeholder="Opcional">
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-agregar-inventario')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Agregar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar Producto -->
    <div id="modal-editar-producto" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Editar Producto</h2>
        <form id="form-editar-producto" class="space-y-4">
          <input type="hidden" id="edit-prod-id">
          <div>
            <label class="block text-sm font-medium mb-1">Nombre</label>
            <input type="text" id="edit-prod-nombre" class="w-full px-3 py-2 border rounded-lg bg-gray-50" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Precio Venta</label>
            <input type="number" id="edit-prod-precio" required class="w-full px-3 py-2 border rounded-lg" min="0" step="1000">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Costo Unitario</label>
            <input type="number" id="edit-prod-costo" required class="w-full px-3 py-2 border rounded-lg" min="0" step="1000">
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-editar-producto')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadInventarioData();

  document.getElementById('form-agregar-inventario').addEventListener('submit', handleAgregarInventario);
  document.getElementById('form-editar-producto').addEventListener('submit', handleEditarProducto);
}

async function loadInventarioData() {
  // Load productos
  const { data: productos } = await supabaseClient.from('productos').select('*').eq('activo', true).order('litros');

  const cardsContainer = document.getElementById('productos-cards');
  cardsContainer.innerHTML = (productos || []).map(p => `
    <div class="bg-white rounded-xl px-4 py-3 shadow flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-bold truncate">${p.nombre}</div>
        <div class="text-xs text-gray-500">${p.litros} L · margen <span class="text-green-600 font-medium">${Math.round((1 - p.costo_unitario / p.precio_venta) * 100)}%</span></div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-semibold">${formatMoney(p.precio_venta)}</div>
        <div class="text-xs text-gray-500">costo ${formatMoney(p.costo_unitario)}</div>
      </div>
      <button onclick="editarProducto('${p.id}')" class="text-primary hover:underline text-sm shrink-0">Editar</button>
    </div>
  `).join('') || '<div class="col-span-3 text-center text-gray-500">Sin productos</div>';

  // Load cobertura
  const { data: cobertura } = await supabaseClient.rpc('cobertura_stock');
  const cobContainer = document.getElementById('cobertura-inventario');
  if (cobertura && cobertura[0]) {
    const c = cobertura[0];
    cobContainer.innerHTML = `
      <div>
        <div class="text-sm text-gray-500">Unidades disponibles</div>
        <div class="text-2xl font-bold">${c.unidades_disponibles || 0} L</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Costo inventario</div>
        <div class="text-2xl font-bold">${formatMoney(c.costo_inventario)}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Venta diaria</div>
        <div class="text-2xl font-bold">${c.venta_diaria_proyectada || 0} L/dia</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Cobertura</div>
        <div class="text-2xl font-bold ${c.cobertura_dias && c.cobertura_dias < 15 ? 'text-red-600' : 'text-green-600'}">${c.cobertura_dias ? c.cobertura_dias + ' dias' : (c.mensaje || '-')}</div>
      </div>
    `;
  }

  // Load movimientos
  const { data: movimientos } = await supabaseClient.from('inventario').select('*').order('fecha', { ascending: false }).limit(20);

  const tbody = document.getElementById('inventario-tbody');
  if (!movimientos || movimientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">Sin movimientos</td></tr>';
    return;
  }

  tbody.innerHTML = movimientos.map(m => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm">${formatDateTime(m.fecha)}</td>
      <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${m.tipo}</span></td>
      <td class="px-4 py-3 text-right font-medium">${m.unidades}</td>
      <td class="px-4 py-3 text-right">${formatMoney(m.costo_unitario)}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${m.nota || '-'}</td>
    </tr>
  `).join('');
}

window.showAgregarInventario = function() {
  document.getElementById('modal-agregar-inventario').classList.remove('hidden');
};

async function handleAgregarInventario(e) {
  e.preventDefault();

  const { error } = await supabaseClient.from('inventario').insert({
    unidades: parseInt(document.getElementById('inv-unidades').value),
    costo_unitario: parseFloat(document.getElementById('inv-costo').value),
    tipo: document.getElementById('inv-tipo').value,
    nota: document.getElementById('inv-nota').value || null
  });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Inventario agregado');
  closeModal('modal-agregar-inventario');
  await loadInventarioData();
}

window.editarProducto = async function(id) {
  const { data: producto } = await supabaseClient.from('productos').select('*').eq('id', id).single();
  if (!producto) return;

  document.getElementById('edit-prod-id').value = id;
  document.getElementById('edit-prod-nombre').value = producto.nombre;
  document.getElementById('edit-prod-precio').value = producto.precio_venta;
  document.getElementById('edit-prod-costo').value = producto.costo_unitario;
  document.getElementById('modal-editar-producto').classList.remove('hidden');
};

async function handleEditarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('edit-prod-id').value;
  const nuevoPrecio = parseFloat(document.getElementById('edit-prod-precio').value);
  const nuevoCosto = parseFloat(document.getElementById('edit-prod-costo').value);

  // Get current costo for history
  const { data: producto } = await supabaseClient.from('productos').select('costo_unitario').eq('id', id).single();

  // Update producto
  const { error } = await supabaseClient.from('productos').update({
    precio_venta: nuevoPrecio,
    costo_unitario: nuevoCosto,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  // Log costo change if different
  if (producto && producto.costo_unitario !== nuevoCosto) {
    await supabaseClient.from('productos_costo_historial').insert({
      producto_id: id,
      costo_anterior: producto.costo_unitario,
      costo_nuevo: nuevoCosto,
      origen: 'panel'
    });
  }

  showToast('Producto actualizado');
  closeModal('modal-editar-producto');
  await loadInventarioData();
}
