// OZOAGRO Panel - Modulo Inventario
async function renderInventario(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <h1 class="text-2xl font-bold text-gray-800">Inventario</h1>
        <div class="flex gap-2">
          <button onclick="showAgregarInventario('entrada')" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Agregar Inventario
          </button>
          <button onclick="showAgregarInventario('salida')" class="border border-red-600 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            Registrar salida
          </button>
        </div>
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nota / observaciones</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Acciones</th>
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
              <option value="salida">Salida</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">Entrada: producto que llega. Ajuste: corrección del conteo. Salida: producto que sale sin venta (muestras, averías, devolución al proveedor).</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" id="inv-nota-label">Nota / observaciones</label>
            <input type="text" id="inv-nota" class="w-full px-3 py-2 border rounded-lg" placeholder="Opcional" maxlength="300">
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
            <label class="block text-sm font-medium mb-1">Precio Venta (publico)</label>
            <input type="number" id="edit-prod-precio" required class="w-full px-3 py-2 border rounded-lg" min="0" step="1000">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Precio Mayorista (costo del distribuidor)</label>
            <input type="number" id="edit-prod-mayorista" class="w-full px-3 py-2 border rounded-lg" min="0" step="1000" placeholder="Dejar vacio = usa precio venta">
            <p class="text-xs text-gray-500 mt-1">Este es el precio al que OZOAGRO le vende al distribuidor. El distribuidor lo paga como su costo.</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Costo Unitario (de OZOAGRO)</label>
            <input type="number" id="edit-prod-costo" required class="w-full px-3 py-2 border rounded-lg" min="0" step="1000">
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-editar-producto')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Guardar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Editar Movimiento (2026-09-14: el CEO puede corregir un movimiento ya registrado) -->
    <div id="modal-editar-mov" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Editar Movimiento</h2>
        <form id="form-editar-mov" class="space-y-4">
          <input type="hidden" id="mov-id">
          <div>
            <label class="block text-sm font-medium mb-1">Fecha</label>
            <input type="datetime-local" id="mov-fecha" required class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tipo</label>
            <select id="mov-tipo" class="w-full px-3 py-2 border rounded-lg">
              <option value="entrada">Entrada</option>
              <option value="ajuste">Ajuste</option>
              <option value="salida">Salida</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Unidades</label>
            <input type="number" id="mov-unidades" required class="w-full px-3 py-2 border rounded-lg" min="1">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Costo Unitario</label>
            <input type="number" id="mov-costo" class="w-full px-3 py-2 border rounded-lg" min="0" step="100">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" id="mov-nota-label">Nota / observaciones</label>
            <input type="text" id="mov-nota" class="w-full px-3 py-2 border rounded-lg" placeholder="Opcional" maxlength="300">
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-editar-mov')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  await loadInventarioData();

  document.getElementById('form-agregar-inventario').addEventListener('submit', handleAgregarInventario);
  document.getElementById('form-editar-producto').addEventListener('submit', handleEditarProducto);
  document.getElementById('form-editar-mov').addEventListener('submit', handleEditarMovimiento);
  document.getElementById('inv-tipo').addEventListener('change', () => ajustarCamposTipo('inv'));
  document.getElementById('mov-tipo').addEventListener('change', () => ajustarCamposTipo('mov'));
  ajustarCamposTipo('inv');
}

// Salida = observaciones obligatorias (por qué sale el producto) y costo opcional; entrada/ajuste = costo obligatorio.
function ajustarCamposTipo(prefijo) {
  const tipo = document.getElementById(prefijo + '-tipo').value;
  const nota = document.getElementById(prefijo + '-nota');
  const label = document.getElementById(prefijo + '-nota-label');
  const costo = document.getElementById(prefijo + '-costo');
  const esSalida = tipo === 'salida';
  nota.required = esSalida;
  nota.placeholder = esSalida ? 'Motivo de la salida (obligatorio): muestra, avería, devolución...' : 'Opcional';
  label.textContent = esSalida ? 'Observaciones: ¿por qué sale?' : 'Nota / observaciones';
  costo.required = !esSalida;
  costo.placeholder = esSalida ? 'Opcional en salida' : '';
}

function movimientoDesdeForm(prefijo) {
  const tipo = document.getElementById(prefijo + '-tipo').value;
  const nota = (document.getElementById(prefijo + '-nota').value || '').trim();
  const unidades = parseInt(document.getElementById(prefijo + '-unidades').value);
  const costoRaw = document.getElementById(prefijo + '-costo').value;
  if (!(unidades > 0)) return { error: 'Las unidades deben ser mayores a 0' };
  if (tipo === 'salida' && !nota) return { error: 'Escribe por qué sale el producto (observaciones)' };
  if (tipo !== 'salida' && costoRaw === '') return { error: 'El costo unitario es obligatorio' };
  return { data: { tipo, unidades, costo_unitario: costoRaw === '' ? 0 : parseFloat(costoRaw), nota: nota || null } };
}

function mensajeErrorInventario(error) {
  if (/inventario_tipo_check|inventario_salida_nota_check/.test(error.message || '')) {
    return 'La base de datos aún no tiene el tipo Salida: falta aplicar la migración 20260914_inventario_salida.sql';
  }
  return 'Error: ' + error.message;
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
        ${p.precio_mayorista ? `<div class="text-xs text-purple-600">mayorista ${formatMoney(p.precio_mayorista)}</div>` : ''}
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
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Sin movimientos</td></tr>';
    return;
  }

  window.__invMovs = {};
  movimientos.forEach(m => { window.__invMovs[m.id] = m; });
  const BADGE = { entrada: 'bg-green-100 text-green-700', ajuste: 'bg-yellow-100 text-yellow-700', salida: 'bg-red-100 text-red-700' };
  tbody.innerHTML = movimientos.map(m => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 text-sm">${formatDateTime(m.fecha)}<button onclick="editarMovimiento('${m.id}')" class="md:hidden block text-primary underline text-xs mt-1">Editar</button></td>
      <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${BADGE[m.tipo] || 'bg-gray-100 text-gray-700'}">${m.tipo}</span></td>
      <td class="px-4 py-3 text-right font-medium ${m.tipo === 'salida' ? 'text-red-600' : ''}">${m.tipo === 'salida' ? '-' : ''}${m.unidades}</td>
      <td class="px-4 py-3 text-right">${m.tipo === 'salida' ? '-' : formatMoney(m.costo_unitario)}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(m.nota || '-')}</td>
      <td class="px-4 py-3 text-right hidden md:table-cell"><button onclick="editarMovimiento('${m.id}')" class="text-primary hover:underline text-sm">Editar</button></td>
    </tr>
  `).join('');
}

window.showAgregarInventario = function(tipo) {
  if (tipo) { document.getElementById('inv-tipo').value = tipo; ajustarCamposTipo('inv'); }
  document.querySelector('#modal-agregar-inventario h2').textContent = tipo === 'salida' ? 'Registrar salida' : 'Agregar Inventario';
  document.getElementById('modal-agregar-inventario').classList.remove('hidden');
};

async function handleAgregarInventario(e) {
  e.preventDefault();
  const r = movimientoDesdeForm('inv');
  if (r.error) { showToast(r.error, 'error'); return; }

  const { error } = await supabaseClient.from('inventario').insert(r.data);

  if (error) {
    showToast(mensajeErrorInventario(error), 'error');
    return;
  }

  showToast(r.data.tipo === 'salida' ? 'Salida registrada' : 'Inventario agregado');
  closeModal('modal-agregar-inventario');
  document.getElementById('form-agregar-inventario').reset();
  ajustarCamposTipo('inv');
  await loadInventarioData();
}

window.editarProducto = async function(id) {
  const { data: producto } = await supabaseClient.from('productos').select('*').eq('id', id).single();
  if (!producto) return;

  document.getElementById('edit-prod-id').value = id;
  document.getElementById('edit-prod-nombre').value = producto.nombre;
  document.getElementById('edit-prod-precio').value = producto.precio_venta;
  document.getElementById('edit-prod-mayorista').value = producto.precio_mayorista || '';
  document.getElementById('edit-prod-costo').value = producto.costo_unitario;
  document.getElementById('modal-editar-producto').classList.remove('hidden');
};

async function handleEditarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('edit-prod-id').value;
  const nuevoPrecio = parseFloat(document.getElementById('edit-prod-precio').value);
  const mayoristaTxt = document.getElementById('edit-prod-mayorista').value.trim();
  const nuevoMayorista = mayoristaTxt === '' ? null : parseFloat(mayoristaTxt);
  const nuevoCosto = parseFloat(document.getElementById('edit-prod-costo').value);

  // Get current costo for history
  const { data: producto } = await supabaseClient.from('productos').select('costo_unitario').eq('id', id).single();

  // Update producto
  const { error } = await supabaseClient.from('productos').update({
    precio_venta: nuevoPrecio,
    precio_mayorista: nuevoMayorista,
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


// 2026-09-14 · Editar un movimiento ya registrado (fecha, tipo, unidades, costo, observaciones).
window.editarMovimiento = function(id) {
  const m = (window.__invMovs || {})[id];
  if (!m) return;
  document.getElementById('mov-id').value = id;
  const d = new Date(m.fecha);
  const pad = (n) => String(n).padStart(2, '0');
  const fechaLocal = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const fEl = document.getElementById('mov-fecha'); fEl.value = fechaLocal; fEl.dataset.orig = fechaLocal; // solo se manda la fecha si el CEO la cambia (el input no guarda segundos)
  document.getElementById('mov-tipo').value = m.tipo;
  document.getElementById('mov-unidades').value = m.unidades;
  document.getElementById('mov-costo').value = m.costo_unitario;
  document.getElementById('mov-nota').value = m.nota || '';
  ajustarCamposTipo('mov');
  document.getElementById('modal-editar-mov').classList.remove('hidden');
};

async function handleEditarMovimiento(e) {
  e.preventDefault();
  const id = document.getElementById('mov-id').value;
  const r = movimientoDesdeForm('mov');
  if (r.error) { showToast(r.error, 'error'); return; }
  const fEl = document.getElementById('mov-fecha');
  const fecha = (fEl.value && fEl.value !== fEl.dataset.orig) ? new Date(fEl.value).toISOString() : undefined;

  const { data, error } = await supabaseClient.from('inventario')
    .update({ ...r.data, ...(fecha ? { fecha } : {}) })
    .eq('id', id).select('id');

  if (error) {
    showToast(mensajeErrorInventario(error), 'error');
    return;
  }
  if (!data || !data.length) { showToast('No se pudo editar el movimiento (sin permiso o no existe)', 'error'); return; }

  showToast('Movimiento actualizado');
  closeModal('modal-editar-mov');
  await loadInventarioData();
}
