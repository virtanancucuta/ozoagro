// OZOAGRO Panel - Configuration
const SUPABASE_URL = 'https://vlcxeajnucdkwamcivgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsY3hlYWpudWNka3dhbWNpdmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjIzMjMsImV4cCI6MjEwMzYzODMyM30.lqxstADKVABBjr-lM3BIh7HgTu4jB33LFIIyhFUVyCM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers
function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function getDateRange(preset) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  switch (preset) {
    case 'today':
      return { start: today.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case '7days':
      const week = new Date(today);
      week.setDate(week.getDate() - 7);
      return { start: week.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case 'month':
      return { start: startOfMonth.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case 'lastmonth':
      return { start: startOfLastMonth.toISOString().split('T')[0], end: endOfLastMonth.toISOString().split('T')[0] };
    default:
      return { start: startOfMonth.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }
}
