// OZOAGRO Panel - Main App
let currentModule = 'pedidos';
let currentUser = null;

// Auth
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
    loadModule(currentModule);
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
}

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  errorEl.classList.add('hidden');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Credenciales incorrectas';
    errorEl.classList.remove('hidden');
    return;
  }

  currentUser = data.user;
  showApp();
  loadModule('pedidos');
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  showLogin();
});

// Navigation
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const module = link.dataset.module;
    if (module) {
      // Update active state
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadModule(module);
    }
  });
});

// Module loader
const modules = {
  pedidos: typeof renderPedidos === 'function' ? renderPedidos : () => '<p>Modulo Pedidos</p>',
  ventas: typeof renderVentas === 'function' ? renderVentas : () => '<p>Modulo Ventas</p>',
  inventario: typeof renderInventario === 'function' ? renderInventario : () => '<p>Modulo Inventario</p>',
  gastos: typeof renderGastos === 'function' ? renderGastos : () => '<p>Modulo Gastos</p>',
  crm: typeof renderCRM === 'function' ? renderCRM : () => '<p>Modulo CRM</p>',
  balance: typeof renderBalance === 'function' ? renderBalance : () => '<p>Modulo Balance</p>',
  config: typeof renderConfig === 'function' ? renderConfig : () => '<p>Modulo Configuracion</p>'
};

async function loadModule(name) {
  currentModule = name;
  const container = document.getElementById('module-container');
  container.innerHTML = '<div class="flex justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';

  try {
    // Call the render function for the module
    if (window['render' + name.charAt(0).toUpperCase() + name.slice(1)]) {
      await window['render' + name.charAt(0).toUpperCase() + name.slice(1)](container);
    } else {
      container.innerHTML = `<div class="bg-white rounded-xl p-6 shadow"><h2 class="text-xl font-bold">Modulo ${name}</h2><p class="text-gray-600 mt-2">Cargando...</p></div>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="bg-red-50 text-red-600 p-4 rounded-lg">Error cargando modulo: ${err.message}</div>`;
  }
}

// Init
checkAuth();
