// OZOAGRO · iconos Lucide usados por la landing, incrustados (2026-09-14). Reemplaza js/lucide.min.js (419 KB, 1.500+ iconos)
// con los 19 que se usan. Misma API: window.lucide.createIcons() convierte <i data-lucide="x"> en el mismo <svg> que
// generaba Lucide (mismos atributos: width/height 24, stroke currentColor, class "lucide lucide-x", data-lucide, aria-hidden).
// Para agregar un icono nuevo: copiar el contenido interno del <svg> desde https://lucide.dev/icons/ a ICONOS.
(function () {
  var ICONOS = {
  "truck": "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"></path><path d=\"M15 18H9\"></path><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\"></path><circle cx=\"17\" cy=\"18\" r=\"2\"></circle><circle cx=\"7\" cy=\"18\" r=\"2\"></circle>",
  "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"></path><path d=\"m9 12 2 2 4-4\"></path>",
  "chevron-up": "<path d=\"m18 15-6-6-6 6\"></path>",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\"></path>",
  "leaf": "<path d=\"M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20\"></path><path d=\"M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13\"></path>",
  "check": "<path d=\"M20 6 9 17l-5-5\"></path>",
  "shopping-cart": "<path d=\"m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18\"></path><path d=\"M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25\"></path><circle cx=\"18\" cy=\"20\" r=\"2\"></circle><circle cx=\"8\" cy=\"20\" r=\"2\"></circle>",
  "arrow-right": "<path d=\"M5 12h14\"></path><path d=\"m12 5 7 7-7 7\"></path>",
  "lock-keyhole": "<circle cx=\"12\" cy=\"16\" r=\"1\"></circle><rect x=\"3\" y=\"10\" width=\"18\" height=\"12\" rx=\"2\"></rect><path d=\"M7 10V7a5 5 0 0 1 10 0v3\"></path>",
  "bug": "<path d=\"M12 20v-9\"></path><path d=\"M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z\"></path><path d=\"M14.12 3.88 16 2\"></path><path d=\"M21 21a4 4 0 0 0-3.81-4\"></path><path d=\"M21 5a4 4 0 0 1-3.55 3.97\"></path><path d=\"M22 13h-4\"></path><path d=\"M3 21a4 4 0 0 1 3.81-4\"></path><path d=\"M3 5a4 4 0 0 0 3.55 3.97\"></path><path d=\"M6 13H2\"></path><path d=\"m8 2 1.88 1.88\"></path><path d=\"M9 7.13V6a3 3 0 1 1 6 0v1.13\"></path>",
  "recycle": "<path d=\"M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5\"></path><path d=\"M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12\"></path><path d=\"m14 16-3 3 3 3\"></path><path d=\"M8.293 13.596 7.196 9.5 3.1 10.598\"></path><path d=\"m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843\"></path><path d=\"m13.378 9.633 4.096 1.098 1.097-4.096\"></path>",
  "flower-2": "<path d=\"M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1\"></path><circle cx=\"12\" cy=\"8\" r=\"2\"></circle><path d=\"M12 10v12\"></path><path d=\"M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z\"></path><path d=\"M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z\"></path>",
  "droplets": "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"></path><path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"></path>",
  "arrow-down": "<path d=\"M12 5v14\"></path><path d=\"m19 12-7 7-7-7\"></path>",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\"></path>",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\"></path>",
  "zoom-out": "<circle cx=\"11\" cy=\"11\" r=\"8\"></circle><line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\"></line><line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\"></line>",
  "zoom-in": "<circle cx=\"11\" cy=\"11\" r=\"8\"></circle><line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\"></line><line x1=\"11\" x2=\"11\" y1=\"8\" y2=\"14\"></line><line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\"></line>",
  "scan": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"></path><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"></path><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"></path><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"></path>",
  "badge-check": "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\"></path><path d=\"m9 12 2 2 4-4\"></path>",
  "monitor-smartphone": "<path d=\"M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8\"></path><path d=\"M10 19v-3.96 3.15\"></path><path d=\"M7 19h5\"></path><rect width=\"6\" height=\"10\" x=\"16\" y=\"12\" rx=\"2\"></rect>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"></path><path d=\"M2 12h20\"></path>",
  "chart-line": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"></path><path d=\"m19 9-5 5-4-4-3 3\"></path>",
  "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"></path>",
  "home": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"></path><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path>",
  "shopping-bag": "<path d=\"M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z\"></path><path d=\"M3 6h18\"></path><path d=\"M16 10a4 4 0 0 1-8 0\"></path>",
  "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"></path><path d=\"M12 22V12\"></path><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\"></path><path d=\"m7.5 4.27 9 5.15\"></path>",
  "bar-chart-2": "<line x1=\"18\" x2=\"18\" y1=\"20\" y2=\"10\"></line><line x1=\"12\" x2=\"12\" y1=\"20\" y2=\"4\"></line><line x1=\"6\" x2=\"6\" y1=\"20\" y2=\"14\"></line>",
  "message-circle": "<path d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22Z\"></path>"
};
  var NS = 'http://www.w3.org/2000/svg';
  function crear(el) {
    var nombre = el.getAttribute('data-lucide');
    var cuerpo = ICONOS[nombre];
    if (!cuerpo) { console.warn('[iconos] icono no incluido:', nombre); return; }
    var svg = document.createElementNS(NS, 'svg');
    var base = { xmlns: NS, width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    Object.keys(base).forEach(function (k) { svg.setAttribute(k, base[k]); });
    Array.prototype.forEach.call(el.attributes, function (a) { if (a.name !== 'class') svg.setAttribute(a.name, a.value); });
    if (!svg.hasAttribute('aria-hidden')) svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', ('lucide lucide-' + nombre + ' ' + (el.getAttribute('class') || '')).trim());
    svg.innerHTML = cuerpo;
    el.parentNode.replaceChild(svg, el);
  }
  function createIcons() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lucide]')).forEach(function (el) {
      if (el.tagName.toLowerCase() !== 'svg') crear(el);
    });
  }
  window.lucide = { createIcons: createIcons, icons: ICONOS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createIcons); else createIcons();
})();
