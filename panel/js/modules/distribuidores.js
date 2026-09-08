// OZOAGRO Panel - Modulo DISTRIBUIDORES (solo CEO)
// Pestañas: Crear (formulario + lista con acciones) | Ventas por distribuidor | CRM y clientes por distribuidor
// Backend: RPC distribuidores_resumen(), ventas_resumen(p_distribuidor_id), crm_clientes(p_distribuidor_id); Edge Function ozoagro-distribuidores (crear/resetear/activar/desactivar)
let distTab = 'crear';
let distLista = [];
let distSel = '';

function distSlugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
}

async function renderDistribuidores(container) {
  if (!window.PERFIL || window.PERFIL.rol !== 'ceo') {
    container.innerHTML = '<div class="bg-red-50 text-red-600 p-4 rounded-lg">Solo el CEO puede ver este modulo.</div>';
    return;
  }
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Distribuidores</h1>
          <p class="text-sm text-gray-500">Cada distribuidor tiene su panel y su landing en ozoagro.co/su-nombre. Sus ventas no se mezclan con las de OZOAGRO.</p>
        </div>
      </div>
      <div class="flex gap-2 border-b">
        <button class="tab-btn px-4 py-2 ${distTab === 'crear' ? 'active' : ''}" onclick="distSetTab('crear')">Crear y administrar</button>
        <button class="tab-btn px-4 py-2 ${distTab === 'ventas' ? 'active' : ''}" onclick="distSetTab('ventas')">Ventas por distribuidor</button>
        <button class="tab-btn px-4 py-2 ${distTab === 'crm' ? 'active' : ''}" onclick="distSetTab('crm')">CRM y clientes</button>
      </div>
      <div id="dist-tab-content"><div class="flex justify-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div></div>
    </div>`;
  await distCargarLista();
  await distRenderTab();
}

window.distSetTab = async function(tab) {
  distTab = tab;
  document.querySelectorAll('#module-container .tab-btn').forEach(b => b.classList.toggle('active', b.textContent.trim().toLowerCase().startsWith(tab === 'crear' ? 'crear' : tab === 'ventas' ? 'ventas' : 'crm')));
  await distRenderTab();
};

async function distCargarLista() {
  const { data, error } = await supabaseClient.rpc('distribuidores_resumen');
  if (error) { showToast('Error cargando distribuidores: ' + error.message, 'error'); distLista = []; return; }
  distLista = data || [];
  if (!distSel && distLista.length) distSel = distLista[0].id;
}

function distSelector() {
  return `<select id="dist-selector" class="px-3 py-2 border rounded-lg" onchange="distSel=this.value; distRenderTab()">
    ${distLista.map(d => `<option value="${d.id}" ${d.id === distSel ? 'selected' : ''}>${escapeHtml(d.nombre)} (${escapeHtml(d.slug)})${d.activo ? '' : ' - inactivo'}</option>`).join('')}
  </select>`;
}

async function distRenderTab() {
  const el = document.getElementById('dist-tab-content');
  if (!el) return;
  if (distTab === 'crear') return distRenderCrear(el);
  if (!distLista.length) { el.innerHTML = '<div class="bg-white rounded-xl p-6 shadow text-gray-500">Aun no hay distribuidores. Crea el primero en la pestaña "Crear y administrar".</div>'; return; }
  if (distTab === 'ventas') return distRenderVentas(el);
  if (distTab === 'crm') return distRenderCrm(el);
}

/* ---------------- CREAR + LISTA ---------------- */
function distRenderCrear(el) {
  el.innerHTML = `
    <div class="grid lg:grid-cols-5 gap-6">
      <div class="lg:col-span-2 bg-white rounded-xl p-6 shadow">
        <h2 class="text-lg font-bold mb-1">Nuevo distribuidor</h2>
        <p class="text-xs text-gray-500 mb-4">Se crea su usuario de acceso y su landing. El usuario y la clave se los entregas tu.</p>
        <form id="form-dist" class="space-y-3">
          <div><label class="block text-sm font-medium mb-1">Nombre completo *</label><input id="d-nombre" required class="w-full px-3 py-2 border rounded-lg" oninput="distAutoSlug()"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm font-medium mb-1">Cedula</label><input id="d-cedula" class="w-full px-3 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-1">Telefono</label><input id="d-telefono" class="w-full px-3 py-2 border rounded-lg" placeholder="3001234567"></div>
            <div><label class="block text-sm font-medium mb-1">Ciudad</label><input id="d-ciudad" class="w-full px-3 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-1">Departamento</label><input id="d-departamento" class="w-full px-3 py-2 border rounded-lg"></div>
          </div>
          <div><label class="block text-sm font-medium mb-1">WhatsApp de su landing *</label><input id="d-whatsapp" required class="w-full px-3 py-2 border rounded-lg" placeholder="3001234567"><p class="text-xs text-gray-500 mt-1">A este numero llegan los clientes de ozoagro.co/su-nombre.</p></div>
          <div><label class="block text-sm font-medium mb-1">Correo (recibe el aviso de cada pedido)</label><input id="d-email" type="email" class="w-full px-3 py-2 border rounded-lg"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm font-medium mb-1">Usuario *</label><input id="d-usuario" required class="w-full px-3 py-2 border rounded-lg" placeholder="andres" pattern="[a-z0-9._\-]{3,30}"></div>
            <div><label class="block text-sm font-medium mb-1">Clave * (min. 8)</label><input id="d-clave" required minlength="8" class="w-full px-3 py-2 border rounded-lg"></div>
          </div>
          <div><label class="block text-sm font-medium mb-1">Enlace de su landing *</label>
            <div class="flex items-center gap-1"><span class="text-sm text-gray-500">ozoagro.co/</span><input id="d-slug" required class="flex-1 px-3 py-2 border rounded-lg" pattern="[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]"></div>
            <p class="text-xs text-gray-500 mt-1">Minusculas, numeros y guiones. Se sugiere desde el nombre.</p></div>
          <button type="submit" class="w-full bg-primary text-white py-2 rounded-lg hover:bg-green-700 font-medium">Crear distribuidor</button>
          <div id="dist-msg" class="text-sm min-h-[20px]"></div>
        </form>
      </div>
      <div class="lg:col-span-3 bg-white rounded-xl shadow overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center"><h2 class="font-bold">Distribuidores (${distLista.length})</h2><button onclick="distRecargar()" class="text-sm text-primary underline">Actualizar</button></div>
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="text-left p-3">Distribuidor</th><th class="text-left p-3">Landing</th><th class="text-left p-3">Usuario</th><th class="text-right p-3">Pedidos</th><th class="text-right p-3">Ventas</th><th class="text-left p-3">Estado</th><th class="p-3">Acciones</th></tr></thead>
          <tbody>${distLista.length ? distLista.map(d => `
            <tr class="border-t ${d.activo ? '' : 'opacity-60'}">
              <td class="p-3"><div class="font-medium">${escapeHtml(d.nombre)}</div><div class="text-xs text-gray-500">${escapeHtml([d.ciudad, d.departamento].filter(Boolean).join(', '))} · WA ${escapeHtml(d.whatsapp || '-')}${d.es_test ? ' · <span class="text-orange-600">prueba</span>' : ''}</div></td>
              <td class="p-3"><a href="https://ozoagro.co/${escapeHtml(d.slug)}" target="_blank" class="text-primary underline">/${escapeHtml(d.slug)}</a> <button onclick="distCopiar('https://ozoagro.co/${escapeHtml(d.slug)}')" class="text-xs text-gray-500 underline ml-1">copiar</button></td>
              <td class="p-3 font-mono text-xs">${escapeHtml(d.usuario || '-')}</td>
              <td class="p-3 text-right">${d.pedidos_total}${d.pedidos_por_confirmar ? ` <span class="text-xs text-orange-600">(${d.pedidos_por_confirmar} por conf.)</span>` : ''}</td>
              <td class="p-3 text-right font-medium">${formatMoney(d.ventas_cerradas)}</td>
              <td class="p-3">${d.activo ? '<span class="text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">Activo</span>' : '<span class="text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs">Inactivo</span>'}</td>
              <td class="p-3 whitespace-nowrap"><div class="flex gap-1 justify-center">
                <button onclick="distResetClave('${d.id}','${escapeHtml(d.nombre)}')" class="px-2 py-1 border rounded text-xs hover:bg-gray-50">Clave</button>
                <button onclick="distActivo('${d.id}', ${d.activo ? 'false' : 'true'})" class="px-2 py-1 border rounded text-xs hover:bg-gray-50">${d.activo ? 'Desactivar' : 'Activar'}</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="7" class="p-6 text-center text-gray-500">Aun no hay distribuidores</td></tr>'}
          </tbody></table></div>
      </div>
    </div>`;
  document.getElementById('form-dist').addEventListener('submit', distCrear);
}

window.distAutoSlug = function() {
  const slug = document.getElementById('d-slug'); const nombre = document.getElementById('d-nombre');
  if (slug && nombre && !slug.dataset.tocado) slug.value = distSlugify(nombre.value.split(' ')[0] || nombre.value);
  const u = document.getElementById('d-usuario'); if (u && !u.value) u.value = slug.value.replace(/-/g, '.');
};
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'd-slug') e.target.dataset.tocado = '1'; });

async function distInvocar(body) {
  const { data, error } = await supabaseClient.functions.invoke('ozoagro-distribuidores', { body });
  if (error) {
    let msg = error.message || 'error';
    try { const ctx = error.context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j && j.error) msg = j.error; } } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.ok === false) throw new Error(data.error || 'error');
  return data;
}

async function distCrear(e) {
  e.preventDefault();
  const msg = document.getElementById('dist-msg'); const btn = e.target.querySelector('button[type="submit"]');
  const body = {
    accion: 'crear', nombre: document.getElementById('d-nombre').value.trim(), cedula: document.getElementById('d-cedula').value.trim(),
    telefono: document.getElementById('d-telefono').value.trim(), ciudad: document.getElementById('d-ciudad').value.trim(), departamento: document.getElementById('d-departamento').value.trim(),
    whatsapp: document.getElementById('d-whatsapp').value.trim(), email: document.getElementById('d-email').value.trim(),
    usuario: document.getElementById('d-usuario').value.trim().toLowerCase(), clave: document.getElementById('d-clave').value, slug: document.getElementById('d-slug').value.trim().toLowerCase()
  };
  try {
    btn.disabled = true; msg.className = 'text-sm text-gray-500'; msg.textContent = 'Creando usuario y landing...';
    const r = await distInvocar(body);
    msg.className = 'text-sm text-green-700';
    msg.innerHTML = `Listo. Entregale estos datos:<br><strong>Panel:</strong> https://ozoagro.co/panel/ · <strong>Usuario:</strong> ${escapeHtml(r.login.email)} · <strong>Clave:</strong> ${escapeHtml(body.clave)}<br><strong>Su landing:</strong> <a class="underline" target="_blank" href="${escapeHtml(r.login.landing)}">${escapeHtml(r.login.landing)}</a>`;
    showToast('Distribuidor creado', 'success');
    e.target.reset(); document.getElementById('d-slug').dataset.tocado = '';
    await distCargarLista(); distSel = r.distribuidor.id;
    // refrescar solo la tabla
    const tmp = document.getElementById('dist-tab-content'); const html = msg.innerHTML; distRenderCrear(tmp); const m2 = document.getElementById('dist-msg'); m2.className = 'text-sm text-green-700'; m2.innerHTML = html;
  } catch (err) {
    msg.className = 'text-sm text-red-600'; msg.textContent = err.message;
  } finally { btn.disabled = false; }
}

window.distRecargar = async function() { await distCargarLista(); await distRenderTab(); };
window.distCopiar = function(t) { navigator.clipboard.writeText(t).then(() => showToast('Enlace copiado', 'success')).catch(() => prompt('Copia el enlace:', t)); };
window.distResetClave = async function(id, nombre) {
  const clave = prompt('Nueva clave para ' + nombre + ' (minimo 8 caracteres):'); if (!clave) return;
  try { await distInvocar({ accion: 'resetear_clave', id, clave }); showToast('Clave actualizada', 'success'); } catch (err) { showToast(err.message, 'error'); }
};
window.distActivo = async function(id, activo) {
  if (!activo && !confirm('El distribuidor no podra entrar al panel y su landing dejara de recibir pedidos. ¿Desactivar?')) return;
  try { await distInvocar({ accion: activo ? 'activar' : 'desactivar', id }); showToast(activo ? 'Activado' : 'Desactivado', 'success'); await distRecargar(); } catch (err) { showToast(err.message, 'error'); }
};

/* ---------------- VENTAS POR DISTRIBUIDOR ---------------- */
async function distRenderVentas(el) {
  const range = (typeof getDateRange === 'function') ? getDateRange('month') : { start: null, end: null };
  el.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2 items-center">${distSelector()}
        <input type="date" id="dv-ini" class="px-3 py-2 border rounded-lg" value="${range.start || ''}"><span class="text-gray-500">a</span><input type="date" id="dv-fin" class="px-3 py-2 border rounded-lg" value="${range.end || ''}">
        <button onclick="distRenderTab()" class="bg-primary text-white px-3 py-2 rounded-lg text-sm">Aplicar</button></div>
      <div id="dv-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>
      <div class="bg-white rounded-xl shadow overflow-hidden"><div class="p-4 border-b font-bold">Pedidos del distribuidor</div><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left p-3">Codigo</th><th class="text-left p-3">Fecha</th><th class="text-left p-3">Cliente</th><th class="text-left p-3">Canal</th><th class="text-left p-3">Estado</th><th class="text-right p-3">Venta</th></tr></thead><tbody id="dv-tabla"><tr><td colspan="6" class="p-4 text-center text-gray-400">Cargando...</td></tr></tbody></table></div></div>
    </div>`;
  const ini = document.getElementById('dv-ini').value || null, fin = document.getElementById('dv-fin').value || null;
  const { data: k, error } = await supabaseClient.rpc('ventas_resumen', { p_fecha_ini: ini, p_fecha_fin: fin, p_distribuidor_id: distSel });
  const r = (!error && k && k[0]) || {};
  document.getElementById('dv-kpis').innerHTML = [['Pedidos', r.num_pedidos || 0], ['Litros', r.litros_vendidos || 0], ['Venta', formatMoney(r.venta_total)], ['Rentabilidad', formatMoney(r.rentabilidad)]]
    .map(([t, v]) => `<div class="bg-white rounded-xl p-4 shadow"><div class="text-sm text-gray-500">${t}</div><div class="text-2xl font-bold text-primary">${v}</div></div>`).join('');
  let q = supabaseClient.fromTodos('pedidos').select('codigo_publico, created_at, estado, canal, subtotal, cliente:clientes(nombre, telefono)').eq('distribuidor_id', distSel).order('created_at', { ascending: false }).limit(300);
  if (ini) q = q.gte('created_at', ini); if (fin) q = q.lte('created_at', fin + 'T23:59:59');
  const { data: peds } = await q;
  document.getElementById('dv-tabla').innerHTML = (peds && peds.length) ? peds.map(p => `<tr class="border-t"><td class="p-3 font-mono text-xs">${escapeHtml(p.codigo_publico)}</td><td class="p-3">${formatDate(p.created_at)}</td><td class="p-3">${escapeHtml(p.cliente?.nombre || '-')}<div class="text-xs text-gray-500">${escapeHtml(p.cliente?.telefono || '')}</div></td><td class="p-3">${escapeHtml(p.canal)}</td><td class="p-3">${escapeHtml(p.estado)}</td><td class="p-3 text-right font-medium">${formatMoney(p.subtotal)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="p-4 text-center text-gray-400">Sin pedidos en el rango</td></tr>';
}

/* ---------------- CRM POR DISTRIBUIDOR ---------------- */
let distCrmData = [];
async function distRenderCrm(el) {
  el.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2 items-center">${distSelector()}<button onclick="distExportarCrm()" class="bg-primary text-white px-3 py-2 rounded-lg text-sm">Exportar Excel</button></div>
      <div class="bg-white rounded-xl shadow overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="text-left p-3">Cliente</th><th class="text-left p-3">Telefono</th><th class="text-left p-3">Ciudad</th><th class="text-left p-3">Cultivo</th><th class="text-right p-3">Litros</th><th class="text-right p-3">Total comprado</th><th class="text-right p-3">Dias sin comprar</th></tr></thead><tbody id="dc-tabla"><tr><td colspan="7" class="p-4 text-center text-gray-400">Cargando...</td></tr></tbody></table></div></div>
    </div>`;
  const { data, error } = await supabaseClient.rpc('crm_clientes', { p_distribuidor_id: distSel });
  distCrmData = (!error && data) || [];
  document.getElementById('dc-tabla').innerHTML = distCrmData.length ? distCrmData.map(c => `<tr class="border-t"><td class="p-3 font-medium">${escapeHtml(c.nombre)}</td><td class="p-3"><a class="text-primary underline" target="_blank" href="${waLink(c.telefono)}">${escapeHtml(c.telefono || '-')}</a></td><td class="p-3">${escapeHtml(c.ciudad || '-')}</td><td class="p-3">${escapeHtml(c.cultivo || '-')}</td><td class="p-3 text-right">${c.total_litros || 0}</td><td class="p-3 text-right">${formatMoney(c.total_valor)}</td><td class="p-3 text-right">${c.dias_sin_comprar ?? '-'}</td></tr>`).join('')
    : '<tr><td colspan="7" class="p-4 text-center text-gray-400">Este distribuidor aun no tiene clientes</td></tr>';
}
window.distExportarCrm = function() {
  if (!distCrmData.length) { showToast('No hay clientes para exportar', 'error'); return; }
  const d = distLista.find(x => x.id === distSel);
  const filas = distCrmData.map(c => ({ Cliente: c.nombre, Telefono: c.telefono, Ciudad: c.ciudad, Cultivo: c.cultivo, Litros: c.total_litros, 'Total comprado': c.total_valor, 'Dias sin comprar': c.dias_sin_comprar }));
  const go = () => { const ws = XLSX.utils.json_to_sheet(filas); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clientes'); XLSX.writeFile(wb, `clientes_${(d && d.slug) || 'distribuidor'}.xlsx`); };
  if (typeof XLSX === 'undefined') { const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'; s.onload = go; document.head.appendChild(s); } else go();
};
