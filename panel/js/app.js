// OZOAGRO Panel - Main App
let currentModule = 'pedidos';
let currentUser = null;

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Ready - Inicializando panel...');

  // Verificar que Supabase esté cargado
  if (typeof supabaseClient === 'undefined') {
    console.error('ERROR: Supabase no cargado');
    document.getElementById('login-error').textContent = 'Error: No se pudo cargar el sistema. Recarga la pagina.';
    document.getElementById('login-error').classList.remove('hidden');
    return;
  }

  console.log('Supabase OK - Verificando sesion...');

  // Inicializar
  checkAuth();
  setupEventListeners();
});

// Auth
async function checkAuth() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      showApp();
      loadModule(currentModule);
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Error checkAuth:', err);
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

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('Login form listener OK');
  } else {
    console.error('ERROR: login-form no encontrado');
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Navigation
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const module = link.dataset.module;
      if (module && module !== currentModule) {
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        loadModule(module);
      }
    });
  });
}

async function handleLogin(e) {
  e.preventDefault();
  console.log('Login intentado...');

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Ingresando...';

  try {
    console.log('Llamando signInWithPassword...');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Error login:', error.message);
      errorEl.textContent = 'Credenciales incorrectas';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesion';
      return;
    }

    console.log('Login exitoso:', data.user.email);
    currentUser = data.user;
    showApp();
    loadModule('pedidos');
  } catch (err) {
    console.error('Error inesperado:', err);
    errorEl.textContent = 'Error de conexion. Intenta de nuevo.';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Iniciar Sesion';
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  showLogin();
}

// Module loader
// loadSeq evita la carrera al cambiar rapido de modulo: el render anterior sigue esperando sus datos
// y al terminar escribe en elementos que ya no existen (TypeError "Cannot set properties of null").
// Ese error de un modulo VIEJO no debe pisar el modulo que el usuario esta viendo.
let loadSeq = 0;
async function loadModule(name) {
  currentModule = name;
  const myLoad = ++loadSeq;
  const container = document.getElementById('module-container');
  container.innerHTML = '<div class="flex justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>';

  try {
    const renderFn = window['render' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (typeof renderFn === 'function') {
      await renderFn(container);
    } else {
      container.innerHTML = '<div class="bg-white rounded-xl p-6 shadow"><h2 class="text-xl font-bold">Modulo ' + name + '</h2><p class="text-gray-600 mt-2">Cargando...</p></div>';
    }
  } catch (err) {
    if (myLoad !== loadSeq) {
      console.warn('Render obsoleto de "' + name + '" ignorado:', err.message);
      return;
    }
    console.error('Error modulo:', err);
    container.innerHTML = '<div class="bg-red-50 text-red-600 p-4 rounded-lg">Error cargando modulo: ' + err.message + ' <button data-m="' + name + '" onclick="loadModule(this.dataset.m)" class="ml-3 underline">Reintentar</button></div>';
  }
}
