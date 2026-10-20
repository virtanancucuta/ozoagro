// OZOAGRO Panel - Configuration
const SUPABASE_URL = 'https://vlcxeajnucdkwamcivgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsY3hlYWpudWNka3dhbWNpdmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjIzMjMsImV4cCI6MjEwMzYzODMyM30.lqxstADKVABBjr-lM3BIh7HgTu4jB33LFIIyhFUVyCM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Multi-tenant: el CEO ve TODO por RLS, pero sus modulos (Pedidos, CRM, Gastos, Inventario) deben mostrar solo lo de OZOAGRO
// (distribuidor_id NULL). Los pedidos/clientes de distribuidores se ven en el modulo Distribuidores, que usa fromTodos().
(function () {
  const TENANT = ['pedidos', 'clientes', 'gastos', 'inventario', 'visitas', 'checkouts_abandonados'];
  const origFrom = supabaseClient.from.bind(supabaseClient);
  supabaseClient.fromTodos = origFrom;
  supabaseClient.from = function (tabla) {
    const b = origFrom(tabla);
    if (!(window.PERFIL && window.PERFIL.rol === 'ceo') || !TENANT.includes(tabla)) return b;
    ['select', 'update', 'delete'].forEach(m => { const o = b[m].bind(b); b[m] = function () { return o.apply(this, arguments).is('distribuidor_id', null); }; });
    return b;
  };
})();

// Helpers
function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
}

// Ajuste automatico: los valores KPI (cifras grandes) se encogen hasta caber en su tarjeta
function fitKpiText(root) {
  (root || document).querySelectorAll('.text-3xl.font-bold, .text-2xl.font-bold, .text-xl.font-bold').forEach(el => {
    if (/^H[1-6]$/.test(el.tagName) || el.closest('button')) return;
    el.style.whiteSpace = 'nowrap';
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize), guard = 0;
    while (el.scrollWidth > el.clientWidth && size > 11 && guard++ < 24) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  });
}
(function () {
  let t;
  const run = () => { clearTimeout(t); t = setTimeout(() => fitKpiText(), 60); };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', run);
})();

// Fechas en hora de Colombia (toISOString() trabaja en UTC: después de las 7 p. m. daba el día siguiente)
const TZ_CO = 'America/Bogota';
function fechaISO(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_CO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date());
}
function hoyISO() { return fechaISO(new Date()); }
// Inicio y fin de un día de Colombia como instante, para filtrar columnas timestamptz
function inicioDiaCO(iso) { return iso + 'T00:00:00-05:00'; }
function finDiaCO(iso) { return iso + 'T23:59:59.999-05:00'; }

function formatDate(date) {
  if (!date) return '-';
  // Una columna DATE ('2026-10-20') se muestra tal cual; new Date() la tomaría como medianoche UTC (día anterior)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ_CO });
}

function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ_CO });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Link de WhatsApp: acepta '3001234567' o '573001234567' (los del agente ya traen el 57)
function waLink(tel, text) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Rango de fechas (AAAA-MM-DD) calculado sobre el día de hoy en Colombia
function getDateRange(preset) {
  const hoy = hoyISO();
  const [y, m, d] = hoy.split('-').map(Number);
  const iso = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd)).toISOString().split('T')[0];   // aritmética de calendario pura, sin zona
  const startOfMonth = iso(y, m - 1, 1);

  switch (preset) {
    case 'today':
      return { start: hoy, end: hoy };
    case '7days':
      return { start: iso(y, m - 1, d - 7), end: hoy };
    case 'month':
      return { start: startOfMonth, end: hoy };
    case 'lastmonth':
      return { start: iso(y, m - 2, 1), end: iso(y, m - 1, 0) };
    default:
      return { start: startOfMonth, end: hoy };
  }
}
