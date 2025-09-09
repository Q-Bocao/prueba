// Q'bocao — Bloque 2: panel lateral + coords de origen + estado mínimo

// Coordenadas de origen (tu obrador) — las que me pasaste
const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };

// Referencias de elementos
const els = {
  cartPanel: document.getElementById('cartPanel'),
  backdrop: document.getElementById('backdrop'),
  openCart: document.getElementById('openCart'),
  closeCart: document.querySelector('#cartPanel .cart-close'),
};

// Abrir / cerrar carrito
function openCart() {
  els.cartPanel.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // evita scroll del fondo
}
function closeCart() {
  els.cartPanel.setAttribute('aria-hidden', 'true');
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; // recupera scroll
}

// Eventos
els.openCart?.addEventListener('click', openCart);
els.closeCart?.addEventListener('click', closeCart);
els.backdrop?.addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

// Burger menu (móvil) — simple toggle
const openMenuBtn = document.getElementById('openMenu');
const menu = document.querySelector('.menu');
openMenuBtn?.addEventListener('click', () => {
  const visible = getComputedStyle(menu).display !== 'none';
  menu.style.display = visible ? 'none' : 'flex';
});

// Estado mínimo del carrito (placeholder)
const state = { items: [] };

// Actualiza subtotal y contenido del panel (placeholder)
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
    // TODO (Bloque futuro): renderizar items con +/– y borrar 🗑️
  }
}
updateCartSummary();

// Export “global” por si lo necesitamos después
window.QBOCO = { ORIGIN, openCart, closeCart, state, updateCartSummary };
