// OZOAGRO Panel - Modulo Pedidos
let pedidosTab = 'por_confirmar';
let pedidosData = [];
let productosCache = [];
let clientesCache = [];

async function renderPedidos(container) {
  // Load productos cache
  if (productosCache.length === 0) {
    const { data } = await supabaseClient.from('productos').select('*').eq('activo', true);
    productosCache = data || [];
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-800">Pedidos</h1>
        <button onclick="showCrearPedido()" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Crear Pedido
        </button>
      </div>

      <!-- Tabs -->
      <div class="border-b flex gap-4">
        <button onclick="setPedidosTab('por_confirmar')" class="tab-btn ${pedidosTab === 'por_confirmar' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Por confirmar</button>
        <button onclick="setPedidosTab('confirmado')" class="tab-btn ${pedidosTab === 'confirmado' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Confirmados</button>
        <button onclick="setPedidosTab('despachado')" class="tab-btn ${pedidosTab === 'despachado' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Despachados</button>
        <button onclick="setPedidosTab('cerrado')" class="tab-btn ${pedidosTab === 'cerrado' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Cerrados</button>
        <button onclick="setPedidosTab('cancelado')" class="tab-btn ${pedidosTab === 'cancelado' ? 'active' : ''} px-4 py-2 text-gray-600 hover:text-primary transition">Cancelados</button>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codigo</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rentabilidad</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody id="pedidos-tbody" class="divide-y">
            <tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Crear Pedido -->
    <div id="modal-crear-pedido" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">Crear Pedido Tradicional</h2>
        <form id="form-crear-pedido" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Buscar cliente (telefono/cedula)</label>
              <input type="text" id="buscar-cliente" class="w-full px-3 py-2 border rounded-lg" placeholder="Buscar...">
              <div id="cliente-result" class="mt-2 text-sm"></div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">O crear nuevo</label>
              <button type="button" onclick="toggleNuevoCliente()" class="text-primary text-sm underline">+ Nuevo cliente</button>
            </div>
          </div>

          <div id="nuevo-cliente-form" class="hidden grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <input type="text" id="nc-nombre" class="px-3 py-2 border rounded-lg" placeholder="Nombre *">
            <input type="text" id="nc-cedula" class="px-3 py-2 border rounded-lg" placeholder="Cedula">
            <input type="text" id="nc-telefono" class="px-3 py-2 border rounded-lg" placeholder="Telefono *">
            <input type="email" id="nc-email" class="px-3 py-2 border rounded-lg" placeholder="Email">
            <input type="text" id="nc-ciudad" class="px-3 py-2 border rounded-lg" placeholder="Ciudad">
            <select id="nc-tipo" class="px-3 py-2 border rounded-lg">
              <option value="generico">Generico</option>
              <option value="distribuidor">Distribuidor</option>
            </select>
          </div>

          <input type="hidden" id="cliente-id-selected">

          <div class="border-t pt-4">
            <h3 class="font-medium mb-2">Productos</h3>
            <div id="items-container" class="space-y-2"></div>
            <button type="button" onclick="addItem()" class="text-primary text-sm mt-2">+ Agregar producto</button>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Ciudad envio</label>
              <input type="text" id="pedido-ciudad" class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Direccion envio</label>
              <input type="text" id="pedido-direccion" class="w-full px-3 py-2 border rounded-lg">
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between"><span>Subtotal:</span><span id="calc-subtotal">$0</span></div>
            <div class="flex justify-between"><span>Costo:</span><span id="calc-costo">$0</span></div>
            <div class="flex justify-between font-bold"><span>Rentabilidad:</span><span id="calc-rentabilidad">$0</span></div>
            <div id="alerta-rentabilidad" class="hidden text-red-600 text-sm mt-2">Alerta: Rentabilidad negativa</div>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-crear-pedido')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Crear Pedido</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Acciones Pedido -->
    <div id="modal-accion-pedido" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 id="accion-titulo" class="text-xl font-bold mb-4">Accion</h2>
        <form id="form-accion-pedido" class="space-y-4">
          <input type="hidden" id="accion-pedido-id">
          <input type="hidden" id="accion-tipo">

          <div id="accion-guia-container" class="hidden">
            <label class="block text-sm font-medium mb-1">Guia</label>
            <input type="text" id="accion-guia" class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div id="accion-transportadora-container" class="hidden">
            <label class="block text-sm font-medium mb-1">Transportadora</label>
            <input type="text" id="accion-transportadora" class="w-full px-3 py-2 border rounded-lg">
          </div>
          <div id="accion-motivo-container" class="hidden">
            <label class="block text-sm font-medium mb-1">Motivo</label>
            <textarea id="accion-motivo" class="w-full px-3 py-2 border rounded-lg" rows="2"></textarea>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" onclick="closeModal('modal-accion-pedido')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" id="accion-submit-btn" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-700">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add item template
  addItem();

  // Load pedidos
  await loadPedidos();

  // Form handlers
  document.getElementById('form-crear-pedido').addEventListener('submit', handleCrearPedido);
  document.getElementById('form-accion-pedido').addEventListener('submit', handleAccionPedido);
  document.getElementById('buscar-cliente').addEventListener('input', debounce(buscarCliente, 300));
}

async function loadPedidos() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, cliente:clientes(*), items:pedido_items(*, producto:productos(*))')
    .eq('estado', pedidosTab)
    .eq('es_test', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  pedidosData = data || [];
  renderPedidosTable();
}

function renderPedidosTable() {
  const tbody = document.getElementById('pedidos-tbody');
  if (pedidosData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No hay pedidos</td></tr>';
    return;
  }

  tbody.innerHTML = pedidosData.map(p => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 font-mono text-sm">${p.codigo_publico || '-'}</td>
      <td class="px-4 py-3 text-sm">${formatDate(p.created_at)}</td>
      <td class="px-4 py-3">
        <div class="font-medium">${p.cliente?.nombre || 'Sin cliente'}</div>
        <div class="text-xs text-gray-500">${p.cliente?.telefono || ''}</div>
      </td>
      <td class="px-4 py-3 text-sm">${p.ciudad_envio || '-'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${p.canal === 'web' ? 'bg-blue-100 text-blue-700' : p.canal === 'agente' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}">${p.canal}</span>
      </td>
      <td class="px-4 py-3 text-right font-medium">${formatMoney(p.subtotal)}</td>
      <td class="px-4 py-3 text-right ${p.rentabilidad_negativa ? 'text-red-600' : 'text-green-600'}">${formatMoney(p.rentabilidad)}</td>
      <td class="px-4 py-3">
        <div class="flex justify-center gap-1">
          ${getAccionesButtons(p)}
        </div>
      </td>
    </tr>
  `).join('');
}

function getAccionesButtons(pedido) {
  const wa = pedido.cliente?.telefono ? `<a href="https://wa.me/57${pedido.cliente.telefono.replace(/\D/g,'')}?text=Hola! Tu pedido ${pedido.codigo_publico}" target="_blank" class="p-1 text-green-600 hover:bg-green-50 rounded" title="WhatsApp"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : '';

  switch (pedido.estado) {
    case 'por_confirmar':
      return `${wa}<button onclick="accionPedido('${pedido.id}','confirmar')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Confirmar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>
        <button onclick="accionPedido('${pedido.id}','cancelar')" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
    case 'confirmado':
      return `${wa}<button onclick="accionPedido('${pedido.id}','despachar')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Despachar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>
        <button onclick="accionPedido('${pedido.id}','cancelar')" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancelar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
    case 'despachado':
      return `${wa}<button onclick="accionPedido('${pedido.id}','cerrar')" class="p-1 text-green-600 hover:bg-green-50 rounded" title="Cerrar (Entregado)"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
        <button onclick="accionPedido('${pedido.id}','devolver')" class="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Devolver"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button>`;
    default:
      return wa;
  }
}

window.setPedidosTab = async function(tab) {
  pedidosTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[onclick="setPedidosTab('${tab}')"]`).classList.add('active');
  await loadPedidos();
};

window.showCrearPedido = function() {
  document.getElementById('modal-crear-pedido').classList.remove('hidden');
};

window.closeModal = function(id) {
  document.getElementById(id).classList.add('hidden');
};

window.toggleNuevoCliente = function() {
  document.getElementById('nuevo-cliente-form').classList.toggle('hidden');
};

let itemCount = 0;
window.addItem = function() {
  const container = document.getElementById('items-container');
  const options = productosCache.map(p => `<option value="${p.id}" data-precio="${p.precio_venta}" data-costo="${p.costo_unitario}" data-litros="${p.litros}">${p.nombre} - ${formatMoney(p.precio_venta)}</option>`).join('');

  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center';
  div.innerHTML = `
    <select class="item-producto flex-1 px-3 py-2 border rounded-lg" onchange="calcularTotales()">
      <option value="">Seleccionar producto</option>
      ${options}
    </select>
    <input type="number" class="item-cantidad w-20 px-3 py-2 border rounded-lg" value="1" min="1" onchange="calcularTotales()">
    <input type="number" class="item-precio w-32 px-3 py-2 border rounded-lg" placeholder="Precio" onchange="calcularTotales()">
    <button type="button" onclick="this.parentElement.remove();calcularTotales()" class="text-red-500 hover:text-red-700">&times;</button>
  `;
  container.appendChild(div);
  itemCount++;

  // Set default precio on select change
  div.querySelector('.item-producto').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    div.querySelector('.item-precio').value = opt.dataset.precio || '';
    calcularTotales();
  });
};

window.calcularTotales = function() {
  let subtotal = 0, costo = 0;
  document.querySelectorAll('#items-container > div').forEach(div => {
    const select = div.querySelector('.item-producto');
    const cantidad = parseInt(div.querySelector('.item-cantidad').value) || 0;
    const precio = parseFloat(div.querySelector('.item-precio').value) || 0;
    const opt = select.options[select.selectedIndex];
    const costoUnit = parseFloat(opt?.dataset?.costo) || 0;

    subtotal += precio * cantidad;
    costo += costoUnit * cantidad;
  });

  document.getElementById('calc-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('calc-costo').textContent = formatMoney(costo);
  document.getElementById('calc-rentabilidad').textContent = formatMoney(subtotal - costo);

  const alertaEl = document.getElementById('alerta-rentabilidad');
  if (subtotal - costo < 0) {
    alertaEl.classList.remove('hidden');
  } else {
    alertaEl.classList.add('hidden');
  }
};

async function buscarCliente(e) {
  const query = e.target.value.trim();
  if (query.length < 3) {
    document.getElementById('cliente-result').innerHTML = '';
    return;
  }

  const { data } = await supabase
    .from('clientes')
    .select('*')
    .or(`telefono.ilike.%${query}%,cedula.ilike.%${query}%,nombre.ilike.%${query}%`)
    .limit(5);

  if (data && data.length > 0) {
    document.getElementById('cliente-result').innerHTML = data.map(c =>
      `<div class="p-2 hover:bg-gray-100 cursor-pointer rounded" onclick="selectCliente('${c.id}','${c.nombre}')">
        <div class="font-medium">${c.nombre}</div>
        <div class="text-xs text-gray-500">${c.telefono || ''} | ${c.cedula || ''}</div>
      </div>`
    ).join('');
  } else {
    document.getElementById('cliente-result').innerHTML = '<div class="text-gray-500 text-sm">No encontrado</div>';
  }
}

window.selectCliente = function(id, nombre) {
  document.getElementById('cliente-id-selected').value = id;
  document.getElementById('buscar-cliente').value = nombre;
  document.getElementById('cliente-result').innerHTML = '<div class="text-green-600 text-sm">Cliente seleccionado</div>';
  document.getElementById('nuevo-cliente-form').classList.add('hidden');
};

async function handleCrearPedido(e) {
  e.preventDefault();

  let clienteId = document.getElementById('cliente-id-selected').value;

  // Create new client if needed
  if (!clienteId && document.getElementById('nc-nombre').value) {
    const { data: newCliente, error } = await supabaseClient.from('clientes').insert({
      nombre: document.getElementById('nc-nombre').value,
      cedula: document.getElementById('nc-cedula').value || null,
      telefono: document.getElementById('nc-telefono').value,
      email: document.getElementById('nc-email').value || null,
      ciudad: document.getElementById('nc-ciudad').value || null,
      tipo: document.getElementById('nc-tipo').value,
      origen: 'tradicional'
    }).select().single();

    if (error) {
      showToast('Error creando cliente: ' + error.message, 'error');
      return;
    }
    clienteId = newCliente.id;
  }

  if (!clienteId) {
    showToast('Selecciona o crea un cliente', 'error');
    return;
  }

  // Create pedido
  const { data: pedido, error: pedidoError } = await supabaseClient.from('pedidos').insert({
    cliente_id: clienteId,
    canal: 'tradicional',
    estado: 'por_confirmar',
    ciudad_envio: document.getElementById('pedido-ciudad').value || null,
    direccion_envio: document.getElementById('pedido-direccion').value || null
  }).select().single();

  if (pedidoError) {
    showToast('Error creando pedido: ' + pedidoError.message, 'error');
    return;
  }

  // Create items
  const items = [];
  document.querySelectorAll('#items-container > div').forEach(div => {
    const select = div.querySelector('.item-producto');
    if (!select.value) return;
    const opt = select.options[select.selectedIndex];
    items.push({
      pedido_id: pedido.id,
      producto_id: select.value,
      cantidad: parseInt(div.querySelector('.item-cantidad').value) || 1,
      precio_unitario: parseFloat(div.querySelector('.item-precio').value) || 0,
      costo_unitario_snapshot: parseFloat(opt.dataset.costo) || 0,
      litros: parseInt(opt.dataset.litros) || 1
    });
  });

  if (items.length > 0) {
    const { error: itemsError } = await supabaseClient.from('pedido_items').insert(items);
    if (itemsError) {
      showToast('Error creando items: ' + itemsError.message, 'error');
      return;
    }
  }

  showToast('Pedido creado: ' + pedido.codigo_publico);
  closeModal('modal-crear-pedido');
  await loadPedidos();
}

window.accionPedido = function(id, tipo) {
  document.getElementById('accion-pedido-id').value = id;
  document.getElementById('accion-tipo').value = tipo;

  // Reset fields
  document.getElementById('accion-guia-container').classList.add('hidden');
  document.getElementById('accion-transportadora-container').classList.add('hidden');
  document.getElementById('accion-motivo-container').classList.add('hidden');

  switch (tipo) {
    case 'confirmar':
      document.getElementById('accion-titulo').textContent = 'Confirmar Pedido';
      document.getElementById('accion-guia-container').classList.remove('hidden');
      break;
    case 'despachar':
      document.getElementById('accion-titulo').textContent = 'Despachar Pedido';
      document.getElementById('accion-guia-container').classList.remove('hidden');
      document.getElementById('accion-transportadora-container').classList.remove('hidden');
      break;
    case 'cerrar':
      document.getElementById('accion-titulo').textContent = 'Cerrar Pedido (Entregado)';
      break;
    case 'cancelar':
      document.getElementById('accion-titulo').textContent = 'Cancelar Pedido';
      document.getElementById('accion-motivo-container').classList.remove('hidden');
      document.getElementById('accion-submit-btn').className = 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700';
      break;
    case 'devolver':
      document.getElementById('accion-titulo').textContent = 'Devolver Pedido';
      document.getElementById('accion-motivo-container').classList.remove('hidden');
      document.getElementById('accion-submit-btn').className = 'px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700';
      break;
  }

  document.getElementById('modal-accion-pedido').classList.remove('hidden');
};

async function handleAccionPedido(e) {
  e.preventDefault();
  const id = document.getElementById('accion-pedido-id').value;
  const tipo = document.getElementById('accion-tipo').value;

  let updateData = {};
  switch (tipo) {
    case 'confirmar':
      updateData = {
        estado: 'confirmado',
        fecha_confirmado: new Date().toISOString(),
        guia: document.getElementById('accion-guia').value || null
      };
      break;
    case 'despachar':
      const guia = document.getElementById('accion-guia').value;
      if (!guia) {
        showToast('La guia es obligatoria para despachar', 'error');
        return;
      }
      updateData = {
        estado: 'despachado',
        fecha_despachado: new Date().toISOString(),
        guia: guia,
        transportadora: document.getElementById('accion-transportadora').value || null
      };
      break;
    case 'cerrar':
      updateData = { estado: 'cerrado', fecha_cerrado: new Date().toISOString() };
      break;
    case 'cancelar':
      updateData = {
        estado: 'cancelado',
        fecha_cancelado: new Date().toISOString(),
        notas: document.getElementById('accion-motivo').value || null
      };
      break;
    case 'devolver':
      updateData = {
        estado: 'devuelto',
        notas: document.getElementById('accion-motivo').value || null
      };
      break;
  }

  const { error } = await supabaseClient.from('pedidos').update(updateData).eq('id', id);
  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Pedido actualizado');
  closeModal('modal-accion-pedido');
  await loadPedidos();
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
