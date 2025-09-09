// Q'bocao — Catálogo desde API + Carrito interactivo + mejoras de carga

// Coordenadas de origen para envío (tuyas) — se usarán en el paso del formulario
const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };

// ======= UI: panel lateral (carrito) =======
const els = {
  cartPanel: document.getElementById('cartPanel'),
  backdrop: document.getElementById('backdrop'),
  openCart: document.getElementById('openCart'),
  closeCart: document.querySelector('#cartPanel .cart-close'),
  grid: document.getElementById('gridCatalogo'),
  catalogStatus: document.getElementById('catalogStatus'),
  cartBody: document.querySelector('.cart-body'),
  subtotalEl: document.querySelector('.cart-footer .cart-row strong'),
  continueBtn: document.querySelector('.cart-footer .btn-primary'),
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

// ======= Estado del carrito =======
const state = { items: [] };
// item = { id, name, price, qty }

function formatMoney(n) {
  return `$${(n || 0).toLocaleString('es-AR')}`;
}

function updateCartSummary() {
  const subtotal = state.items.reduce((acc, it) => acc + it.price * it.qty, 0);
  els.subtotalEl.textContent = formatMoney(subtotal);

  if (state.items.length === 0) {
    els.cartBody.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
    els.continueBtn.disabled = true;
  } else {
    els.continueBtn.disabled = false;
    renderCart();
  }
}

function renderCart() {
  if (state.items.length === 0) {
    els.cartBody.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
    return;
  }
  els.cartBody.innerHTML = state.items.map(it => `
    <div class="cart-item" data-id="${it.id}">
      <div class="ci-row" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div style="min-width:0">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(it.name)}</div>
          <div class="muted" style="font-size:.9rem">${formatMoney(it.price)} c/u</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn ci-dec" aria-label="Restar" title="Restar">−</button>
          <span class="ci-qty" style="min-width:24px;text-align:center">${it.qty}</span>
          <button class="btn ci-inc" aria-label="Sumar" title="Sumar">+</button>
          <button class="btn" style="margin-left:6px" aria-label="Quitar" title="Quitar">🗑️</button>
        </div>
      </div>
      <div style="text-align:right;margin-top:4px"><strong>${formatMoney(it.price * it.qty)}</strong></div>
      <hr style="border:none;border-top:1px solid #EDE5DD;margin:10px 0">
    </div>
  `).join('');
}

// Event delegation para + / − / borrar
els.cartBody?.addEventListener('click', (ev) => {
  const itemEl = ev.target.closest('.cart-item');
  if (!itemEl) return;
  const id = itemEl.dataset.id;
  const idx = state.items.findIndex(x => x.id === id);
  if (idx < 0) return;

  if (ev.target.classList.contains('ci-inc')) {
    state.items[idx].qty += 1;
  } else if (ev.target.classList.contains('ci-dec')) {
    state.items[idx].qty -= 1;
    if (state.items[idx].qty <= 0) state.items.splice(idx, 1);
  } else if (ev.target.tagName === 'BUTTON' && !ev.target.classList.contains('ci-inc') && !ev.target.classList.contains('ci-dec')) {
    // botón 🗑️
    state.items.splice(idx, 1);
  } else {
    return;
  }
  updateCartSummary();
});

// ======= Catálogo desde API (con lazy images y mejora de caché) =======
// Estructura esperada JSON:
// { updated, count, productos: [{ id, nombre, descripcion, precio, imagen, disponible, agotado }] }
const MENU_API_URL = window.MENU_API_URL;
const CATALOG_CSV_URL = window.CATALOG_CSV_URL || null; // fallback opcional

async function loadCatalog() {
  // Loader inicial, por si lo tenés en el HTML
  if (els.catalogStatus) els.catalogStatus.textContent = 'Cargando catálogo…';

  // 1) Intentar API JSON (sin cache-busting para que el navegador ayude)
  if (MENU_API_URL) {
    try {
      const res = await fetch(MENU_API_URL); // permitir cache del navegador
      const raw = await res.text();

      let data;
      try { data = JSON.parse(raw); }
      catch (e) {
        console.error('Respuesta no-JSON de la API:', raw);
        showError('La API respondió un formato no válido. Verificá que doGet() devuelva JSON.');
        return;
      }

      if (!data || !Array.isArray(data.productos)) {
        console.error('JSON inesperado:', data);
        showError('La API no trae la propiedad "productos". Revisá el Apps Script.');
        return;
      }

      let items = data.productos.map(normalizeFromAPI).filter(it => it.nombre);

      // Disponibles primero
      const disponibles = items.filter(i => i.activo);
      const agotados = items.filter(i => !i.activo);
      items = [...disponibles, ...agotados];

      renderCatalog(items);
      return;
    } catch (err) {
      console.error('Error al llamar a la API:', err);
      // seguir a fallback si existe
    }
  }

  // 2) Fallback CSV (opcional)
  if (CATALOG_CSV_URL) {
    try {
      const res = await fetch(CATALOG_CSV_URL, { cache: 'no-store' });
      const text = await res.text();
      const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });

      let items = parsed.data.map(normalizeFromCSV).filter(it => it.nombre);
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
  showError('No se pudo cargar el catálogo. Revisá la URL de la API o el fallback CSV.');
}

function showError(msg){
  if (els.grid) els.grid.innerHTML = `<p class="muted">${msg}</p>`;
}

function normalizeFromAPI(row) {
  // row: { id, nombre, descripcion, precio, imagen, disponible, agotado }
  const precioNum = Number(row.precio) || 0;
  const activo = !!row.disponible && !row.agotado;

  return {
    id: (row.id || '').toString(),
    nombre: (row.nombre || '').toString().trim(),
    descripcion: (row.descripcion || '').toString().trim(),
    precio: precioNum,
    activo,
    foto: (row.imagen || '').toString().trim() // nombre de archivo en assets/images/postres/
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
  if (els.catalogStatus) els.catalogStatus.remove?.();

  els.grid.innerHTML = items.map(it => {
    const agotado = !it.activo;
    const badge = agotado ? `<span class="badge-out">AGOTADO</span>` : '';
    const disabled = agotado ? 'disabled' : '';
    const imgSrc = it.foto ? `assets/images/postres/${it.foto}` : logoFallback;

    return `
      <article class="card">
        <figure class="figure">
          <img class="thumb" src="${imgSrc}" alt="${escapeHtml(it.nombre)}"
               loading="lazy" onerror="this.src='${logoFallback}'" />
          ${badge}
        </figure>
        <div class="body">
          <h3>${escapeHtml(it.nombre)}</h3>
          <p class="muted">${escapeHtml(it.descripcion)}</p>
          <div class="meta">
            <span class="price">${formatMoney(it.precio)}</span>
            <button class="btn btn-primary btn-add"
              data-id="${encodeURIComponent(it.id)}"
              data-name="${encodeURIComponent(it.nombre)}"
              data-price="${it.precio}"
              ${disabled}>Agregar</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ======= Agregar al carrito =======
els.grid?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.btn-add');
  if (!btn) return;

  const id = decodeURIComponent(btn.dataset.id || '');
  const name = decodeURIComponent(btn.dataset.name || '');
  const price = Number(btn.dataset.price) || 0;

  if (!id || !name) return;

  const existing = state.items.find(it => it.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.items.push({ id, name, price, qty: 1 });
  }
  updateCartSummary();
  openCart(); // mostrar carrito al agregar
});

// Utilidad segura
function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// Dispara la carga al entrar
document.addEventListener('DOMContentLoaded', loadCatalog);

// Exponer utilidades si hace falta luego
window.QBOCO = { ORIGIN, state, openCart, closeCart, updateCartSummary };
