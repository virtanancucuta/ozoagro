/* OZOAGRO — Conexión de la landing con Supabase (panel CEO)
   - registrar_visita al cargar (utm/fbclid/ttclid)
   - registrar_carrito_abandonado a los 60 s con nombre + teléfono
   - crear_pedido_web desde el formulario contraentrega (script.js llama a window.ozoagroEnviarPedido)
   - reseñas: resenas_publicas() + crear_resena() (widget para visitantes)
*/
(function () {
  const SUPABASE_URL = 'https://vlcxeajnucdkwamcivgy.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsY3hlYWpudWNka3dhbWNpdmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjIzMjMsImV4cCI6MjEwMzYzODMyM30.lqxstADKVABBjr-lM3BIh7HgTu4jB33LFIIyhFUVyCM';
  if (!window.supabase || !window.supabase.createClient) { console.error('OZOAGRO: supabase-js no cargó'); return; }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const params = new URLSearchParams(window.location.search);
  const LITROS = { '1 Unidad': 1, 'Galón (4 L)': 4, '10 Unidades': 10, '20 Unidades': 20 };

  /* ---------- Distribuidor por slug: ozoagro.co/{slug} ---------- */
  const WA_OZOAGRO = '573145933481';
  const RESERVADOS = ['panel', 'images', 'videos', 'js', 'css', 'api', 'admin', 'ozoagro', 'login', 'index', 'landing', 'manifest', 'robots', 'sitemap'];
  const mSlug = location.pathname.match(/^\/([a-z0-9][a-z0-9-]{1,28}[a-z0-9])\/?$/i);
  const SLUG = (mSlug && !RESERVADOS.includes(mSlug[1].toLowerCase())) ? mSlug[1].toLowerCase() : null;
  let DIST = null;   // {slug, nombre, ciudad, departamento, whatsapp} si el slug existe y está activo
  function aplicarDistribuidor(d) {
    DIST = d;
    const wa = String(d.whatsapp || '').replace(/\D/g, '');
    if (wa) {
      document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
        const h = a.getAttribute('href');
        if (h.includes('wa.me/' + WA_OZOAGRO) || /wa\.me\/?(\?|$)/.test(h)) a.setAttribute('href', h.replace(/wa\.me\/\d*/, 'wa.me/' + wa));
      });
    }
    const header = document.querySelector('.site-header');
    if (header && !document.querySelector('.ozo-asesor')) {
      const f = document.createElement('div'); f.className = 'ozo-asesor';
      f.innerHTML = 'Tu asesor OZOAGRO: <b>' + esc(d.nombre) + '</b>' + (d.ciudad ? ' · ' + esc([d.ciudad, d.departamento].filter(Boolean).join(', ')) : '') + (wa ? ' · <a href="https://wa.me/' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : '');
      header.insertAdjacentElement('afterend', f);
    }
  }

  const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
  function normalizarTelefono(t) {
    let d = soloDigitos(t);
    if (d.length === 10 && d[0] === '3') d = '57' + d;     // celular colombiano sin indicativo
    return d;
  }
  // Base de recursos: en la copia de la raíz (GitHub Pages) los assets viven en landing/
  const cssLink = document.querySelector('link[rel="stylesheet"][href$="styles.css"]');
  const ASSET_BASE = cssLink ? cssLink.getAttribute('href').replace(/styles\.css$/, '') : '';
  const asset = (u) => (!u || /^(https?:)?\/\//.test(u) || u.startsWith('data:')) ? u : ASSET_BASE + u;
  // Meta Pixel (24936831939337917): eventos estándar de conversión
  const PRECIOS = { 1: 129900, 4: 409900, 10: 1100000, 20: 1998000 };
  function pixel(evento, datos) { try { if (typeof window.fbq === 'function') window.fbq('track', evento, datos || {}); } catch (e) {} }
  function datosProducto(nombre) { const l = LITROS[nombre] || 1; return { content_name: 'OZOAGRO ' + nombre, content_ids: ['ozoagro-' + l + 'l'], content_type: 'product', value: PRECIOS[l] || 0, currency: 'COP', distribuidor: (DIST && DIST.slug) || 'ozoagro' }; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Cargar distribuidor (si hay slug) y luego registrar la visita ---------- */
  const distListo = (async () => {
    if (!SLUG) return null;
    try {
      const { data, error } = await sb.rpc('distribuidor_publico', { p_slug: SLUG });
      if (!error && data && data.slug) aplicarDistribuidor(data);
    } catch (e) { console.log('Distribuidor no cargado:', e); }
    return DIST;
  })();
  const slugActivo = () => (DIST ? DIST.slug : null);

  /* ---------- Visita ---------- */
  (async () => {
    try {
      await distListo;
      await sb.rpc('registrar_visita', {
        p_distribuidor_slug: slugActivo(),
        p_pagina: '/', p_referrer: document.referrer || null,
        p_utm_source: params.get('utm_source'), p_utm_medium: params.get('utm_medium'), p_utm_campaign: params.get('utm_campaign'),
        p_fbclid: params.get('fbclid'), p_ttclid: params.get('ttclid')
      });
    } catch (e) { console.log('Visita no registrada:', e); }
  })();

  /* ---------- Carrito abandonado (60 s con nombre + teléfono) ---------- */
  const carrito = {}; let carritoTimer = null;
  function trackCarrito(campo, valor) {
    carrito[campo] = valor;
    if (carritoTimer) clearTimeout(carritoTimer);
    if (carrito.nombre && soloDigitos(carrito.telefono).length >= 10) {
      carritoTimer = setTimeout(async () => {
        try {
          await sb.rpc('registrar_carrito_abandonado', {
            p_nombre: carrito.nombre, p_telefono: normalizarTelefono(carrito.telefono),
            p_producto_id: null, p_ciudad: carrito.ciudad || null, p_email: carrito.email || null,
            p_distribuidor_slug: slugActivo()
          });
        } catch (e) { console.log('Carrito no registrado:', e); }
      }, 60000);
    }
  }
  ['nombre', 'telefono', 'ciudad', 'email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => trackCarrito(id, el.value.trim()));
  });

  /* ---------- Pixel: ViewContent al elegir presentación, InitiateCheckout al abrir el formulario ---------- */
  document.querySelectorAll('.presentation-card').forEach(card => card.addEventListener('click', () => pixel('ViewContent', datosProducto(card.dataset.product))));
  ['mainOrderBtn', 'stickyOrderBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => {
    const sel = document.querySelector('.presentation-card.selected'); pixel('InitiateCheckout', Object.assign(datosProducto(sel ? sel.dataset.product : 'Galón (4 L)'), { num_items: 1 }));
  }); });

  /* ---------- Productos (por litros) ---------- */
  let productosCache = null;
  async function productoPorLitros(litros) {
    if (!productosCache) {
      const { data, error } = await sb.from('productos').select('id, litros, nombre, precio_venta').eq('activo', true);
      if (error) throw error;
      productosCache = data || [];
    }
    return productosCache.find(p => Number(p.litros) === Number(litros)) || null;
  }

  /* ---------- Envío del pedido (lo llama script.js) ---------- */
  window.ozoagroEnviarPedido = async function (order, form) {
    const btn = form.querySelector('button[type="submit"]');
    const msg = document.getElementById('formMessage');
    const litros = LITROS[order.product] || 1;
    const btnHtml = btn ? btn.innerHTML : '';
    if (carritoTimer) clearTimeout(carritoTimer);
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<span>ENVIANDO...</span><small>UN MOMENTO</small>'; }
      if (msg) { msg.textContent = ''; msg.style.color = ''; }
      const producto = await productoPorLitros(litros);
      if (!producto) throw new Error('Producto no disponible');
      const direccion = [order.direccion, order.barrio ? 'Barrio ' + order.barrio : '', order.indicaciones].map(s => String(s || '').trim()).filter(Boolean).join(' · ');
      const { data, error } = await sb.rpc('crear_pedido_web', {
        p_nombre: [order.nombre, order.apellido].map(s => String(s || '').trim()).filter(Boolean).join(' '),
        p_telefono: normalizarTelefono(order.telefono),
        p_producto_id: producto.id,
        p_cantidad: 1,
        p_email: String(order.email || '').trim().toLowerCase() || null,
        p_direccion: direccion,
        p_ciudad: String(order.ciudad || '').trim(),
        p_departamento: order.departamento || null,
        p_utm_source: params.get('utm_source'),
        p_fbclid: params.get('fbclid'),
        p_cultivo: null,
        p_distribuidor_slug: slugActivo()
      });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      const total = Number(data.total || producto.precio_venta || 0).toLocaleString('es-CO');
      form.innerHTML =
        '<div class="ozo-exito" role="status">' +
        '<div class="ozo-exito-icono">✓</div>' +
        '<h3>¡Pedido recibido!</h3>' +
        '<p>Tu pedido <strong>' + esc(data.codigo || '') + '</strong> quedó registrado.<br>' +
        esc(order.product) + ' · Total <strong>$' + total + '</strong> · Pago contra entrega · Envío gratis.</p>' +
        '<p>Te contactaremos por WhatsApp al <strong>' + esc(order.telefono) + '</strong> para confirmar la entrega.</p>' +
        '<a class="ozo-exito-wa" href="https://wa.me/' + (DIST && DIST.whatsapp ? String(DIST.whatsapp).replace(/\D/g, '') : WA_OZOAGRO) + '?text=' + encodeURIComponent('Hola, acabo de hacer el pedido ' + (data.codigo || '') + ' en la página de OZOAGRO') + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>' +
        '</div>';
      pixel('Purchase', Object.assign(datosProducto(order.product), { value: Number(data.total || producto.precio_venta || 0), num_items: 1, order_id: data.codigo || '' }));
      console.log('Pedido creado:', data);
    } catch (err) {
      console.error('Error creando pedido:', err);
      if (msg) { msg.style.color = '#b42318'; msg.textContent = 'No pudimos registrar tu pedido. Intenta de nuevo o escríbenos por WhatsApp.'; }
      if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
    }
  };

  /* ---------- Reseñas ---------- */
  const grid = document.getElementById('reviewsGrid');
  function estrellas(n) { n = Math.max(1, Math.min(5, Number(n) || 5)); return '★'.repeat(n) + '<span class="ozo-star-off">' + '★'.repeat(5 - n) + '</span>'; }
  function tarjeta(r) {
    const meta = [r.ciudad, r.cultivo].filter(Boolean).join(' · ');
    const foto = r.foto_url
      ? '<img src="' + esc(asset(r.foto_url)) + '" alt="Productor que usa OZOAGRO" decoding="async">'
      : '<div class="ozo-avatar" aria-hidden="true"><span>' + esc(String(r.nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()) + '</span><small>Cliente OZOAGRO</small></div>';
    return '<article class="review-card"><div class="review-product">' + foto + '</div>' +
      '<div class="review-stars">' + estrellas(r.estrellas) + '</div>' +
      '<h3>' + esc(r.nombre) + '</h3>' +
      (meta ? '<div class="review-meta">📍 ' + esc(meta) + '</div>' : '') +
      '<p class="review-text">“' + esc(r.texto) + '”</p></article>';
  }
  async function cargarResenas() {
    if (!grid) return;
    try {
      const { data, error } = await sb.rpc('resenas_publicas', { p_limit: 12 });
      if (error) throw error;
      if (data && data.length) grid.innerHTML = data.map(tarjeta).join('');
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    } catch (e) { console.log('Reseñas no cargadas:', e); }
  }
  cargarResenas();

  const rf = document.getElementById('reviewForm');
  if (rf) {
    rf.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!rf.checkValidity()) { rf.reportValidity(); return; }
      const fd = new FormData(rf);
      const out = document.getElementById('reviewMessage');
      const btn = rf.querySelector('button[type="submit"]');
      const estrellasSel = Number(fd.get('estrellas') || 0);
      if (!estrellasSel) { out.textContent = 'Selecciona de 1 a 5 estrellas'; out.style.color = '#b42318'; return; }
      try {
        btn.disabled = true; out.style.color = ''; out.textContent = 'Enviando...';
        const { data, error } = await sb.rpc('crear_resena', {
          p_nombre: fd.get('r_nombre'), p_ciudad: fd.get('r_ciudad'), p_cultivo: fd.get('r_cultivo'),
          p_estrellas: estrellasSel, p_texto: fd.get('r_texto'), p_telefono: normalizarTelefono(fd.get('r_telefono')) || null
        });
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
        if (grid) grid.insertAdjacentHTML('afterbegin', tarjeta({ nombre: fd.get('r_nombre'), ciudad: fd.get('r_ciudad'), cultivo: fd.get('r_cultivo'), estrellas: estrellasSel, texto: fd.get('r_texto') }));
        rf.reset();
        out.style.color = ''; out.textContent = '¡Gracias! Tu reseña ya está publicada.';
      } catch (err) {
        out.style.color = '#b42318'; out.textContent = err.message || 'No pudimos publicar tu reseña. Intenta de nuevo.';
      } finally { btn.disabled = false; }
    });
  }
})();
