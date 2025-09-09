// Q'bocao — Panel lateral + Catálogo desde API Apps Script (JSON) + base de estado

// Coordenadas de origen para envío (las tuyas)
const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };

// ======= UI: panel lateral (carrito) =======
const els = {
  cartPanel: document.getElementById('cartPanel'),
  backdrop: document.getElementById('backdrop'),
  openCart: document.getElementById('openCart'),
  closeCart: document.querySelector('#cartPanel .cart-close'),
  grid: document.getElementById('gridCatalogo')
};

function openCart() {
  els.cartPanel.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  els.cartPanel.setAttribute('aria-hidden', 'true');
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
els.openCart?.addEventListener('click', openCart);
els.closeCart?.addEventListener('click', closeCart);
els.backdrop?.addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

// Burger menú móvil
const openMenuBtn = document.getElementById('openMenu');
const menu = document.querySelector('.menu');
openMenuBtn?.addEventListener('click', () => {
  const visible = getComputedStyle(menu).display !== 'none';
  menu.style.display = visible ? 'none' : 'flex';
});

// ======= Estado mínimo (carrito todavía vacío) =======
const state = { items: [] };

function updateCartSummary() {
  const subtotalEl = document.querySelector('.cart-footer .cart-row strong');
  const continueBtn = document.querySelector('.cart-footer .btn-primary');
  const body = document.querySelector('.cart-body');

  const subtotal = state.items.reduce((acc, it) => acc + it.price * it.qty, 0);
  subtotalEl.textContent = `$${subtotal.toLocaleString('es-AR')}`;

  if (state.items.length === 0) {
    body.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
    continueBtn.disabled = true;
  } else {
    continueBtn.disabled = false;
    // Próximo bloque: render editable del carrito (+/–/🗑️)
  }
}
updateCartSummary();

// ======= Catálogo desde API (Apps Script JSON) =======
// Estructura esperada:
// { updated, count, productos: [{ id, nombre, descripcion, precio, imagen, disponible, agotado }] }
const MENU_API_URL = window.MENU_API_URL;
const CATALOG_CSV_URL = window.CATALOG_CSV_URL || 'data/catalogo.csv'; // fallback opcional

async function loadCatalog() {
  // 1) Intentar API JSON
  if (MENU_API_URL) {
    try {
      const res = await fetch(MENU_API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('API no respondió OK');
      const data = await res.json();
      if (!data || !Array.isArray(data.productos)) throw new Error('Formato JSON inesperado');

      let items = data.productos.map(row => normalizeFromAPI(row)).filter(it => it.nombre);

      // Disponibles primero
      const disponibles = items.filter(i => i.activo);
      const agotados = items.filter(i => !i.activo);
      items = [...disponibles, ...agotados];

      renderCatalog(items);
      return;
    } catch (err) {
      console.error('Error API JSON:', err);
      // si definiste CATALOG_CSV_URL, intentamos fallback CSV
    }
  }

  // 2) Fallback CSV (opcional)
  if (CATALOG_CSV_URL) {
    try {
      const res = await fetch(CATALOG_CSV_URL, { cache: 'no-store' });
      const text = await res.text();
      const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });

      let items = parsed.data.map(row => normalizeFromCSV(row)).filter(it => it.nombre);

      const disponibles = items.filter(i => i.activo);
      const agotados = items.filter(i => !i.activo);
      items = [...disponibles, ...agotados];

      renderCatalog(items);
      return;
    } catch (err) {
      console.error('Error CSV:', err);
    }
  }

  // 3) Si nada cargó
  els.grid.innerHTML = `<p class="muted">No se pudo cargar el catálogo. Verificá la URL de la API.</p>`;
}

function normalizeFromAPI(row) {
  // row: { id, nombre, descripcion, precio, imagen, disponible, agotado }
  const precioNum = Number(row.precio) || 0;
  return {
    id: (row.id || '').toString(),
    nombre: (row.nombre || '').toString().trim(),
    descripcion: (row.descripcion || '').toString().trim(),
    precio: precioNum,
    activo: !!row.disponible && !row.agotado, // disponible=TRUE y no agotado
    foto: (row.imagen || '').toString().trim() // nombre de archivo
  };
}

function normalizeFromCSV(row) {
  // Espera columnas: Producto, Descripcion, Precio, Activo, Foto
  const precioNum = toNumber(row.Precio);
  return {
    id: (row.Producto || '').toString().trim().toLowerCase().replace(/\s+/g,'-'),
    nombre: (row.Producto || '').toString().trim(),
    descripcion: (row.Descripcion || '').toString().trim(),
    precio: isNaN(precioNum) ? 0 : precioNum,
    activo: ((row.Activo || '').toString().trim().toUpperCase() === 'SI'),
    foto: (row.Foto || '').toString().trim()
  };
}

function toNumber(v) {
  if (v == null) return NaN;
  const s = v.toString().replace(/[^\d.,]/g, '');
  if (s.includes(',') && s.includes('.')) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) return Number(s.replace(',', '.'));
  return Number(s);
}

function renderCatalog(items) {
  const logoFallback = 'assets/images/logo.png';
  els.grid.innerHTML = items.map(it => {
    const agotado = !it.activo;
    const badge = agotado ? `<span class="badge-out">AGOTADO</span>` : '';
    const disabled = agotado ? 'disabled' : '';
    const imgSrc = it.foto ? `assets/images/postres/${it.foto}` : logoFallback;

    return `
      <article class="card">
        <figure class="figure">
          <img class="thumb" src="${imgSrc}" alt="${escapeHtml(it.nombre)}"
               onerror="this.src='${logoFallback}'" />
          ${badge}
        </figure>
        <div class="body">
          <h3>${escapeHtml(it.nombre)}</h3>
          <p class="muted">${escapeHtml(it.descripcion)}</p>
          <div class="meta">
            <span class="price">$${(it.precio || 0).toLocaleString('es-AR')}</span>
            <button class="btn btn-primary btn-add" data-id="${encodeURIComponent(it.id)}" data-name="${encodeURIComponent(it.nombre)}" ${disabled}>Agregar</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Aquí después agregamos listeners para .btn-add (sumar al carrito)
}

function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

document.addEventListener('DOMContentLoaded', loadCatalog);

// Exponer utilidades por si hace falta luego
window.QBOCO = { ORIGIN, state, openCart, closeCart, updateCartSummary };
