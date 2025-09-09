// Q'bocao — Catálogo desde API + caché local + skeletons + carrito interactivo

const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };

const els = {
  cartPanel: document.getElementById('cartPanel'),
  backdrop: document.getElementById('backdrop'),
  openCart: document.getElementById('openCart'),
  closeCart: document.querySelector('#cartPanel .cart-close'),
  grid: document.getElementById('gridCatalogo'),
  cartBody: document.querySelector('.cart-body'),
  subtotalEl: document.querySelector('.cart-footer .cart-row strong'),
  continueBtn: document.querySelector('.cart-footer .btn-primary'),
};
function openCart(){ els.cartPanel.setAttribute('aria-hidden','false'); els.backdrop.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeCart(){ els.cartPanel.setAttribute('aria-hidden','true'); els.backdrop.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
els.openCart?.addEventListener('click', openCart);
els.closeCart?.addEventListener('click', closeCart);
els.backdrop?.addEventListener('click', closeCart);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCart(); });

// Burger móvil
const openMenuBtn = document.getElementById('openMenu');
const menu = document.querySelector('.menu');
openMenuBtn?.addEventListener('click', () => {
  const visible = getComputedStyle(menu).display !== 'none';
  menu.style.display = visible ? 'none' : 'flex';
});

// ======== Carrito ========
const state = { items: [] }; // {id,name,price,qty}
const money = n => `$${(n||0).toLocaleString('es-AR')}`;

function updateCartSummary(){
  const subtotal = state.items.reduce((a,it)=>a+it.price*it.qty,0);
  els.subtotalEl.textContent = money(subtotal);
  if(state.items.length===0){
    els.cartBody.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
    els.continueBtn.disabled = true;
  } else {
    els.continueBtn.disabled = false;
    renderCart();
  }
}
function renderCart(){
  els.cartBody.innerHTML = state.items.map(it=>`
    <div class="cart-item" data-id="${it.id}">
      <div class="ci-row" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div style="min-width:0">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(it.name)}</div>
          <div class="muted" style="font-size:.9rem">${money(it.price)} c/u</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn ci-dec" aria-label="Restar" title="Restar">−</button>
          <span class="ci-qty" style="min-width:24px;text-align:center">${it.qty}</span>
          <button class="btn ci-inc" aria-label="Sumar" title="Sumar">+</button>
          <button class="btn" style="margin-left:6px" aria-label="Quitar" title="Quitar">🗑️</button>
        </div>
      </div>
      <div style="text-align:right;margin-top:4px"><strong>${money(it.price*it.qty)}</strong></div>
      <hr style="border:none;border-top:1px solid #EDE5DD;margin:10px 0">
    </div>
  `).join('');
}
els.cartBody?.addEventListener('click', ev=>{
  const itemEl = ev.target.closest('.cart-item'); if(!itemEl) return;
  const id = itemEl.dataset.id; const i = state.items.findIndex(x=>x.id===id); if(i<0) return;
  if(ev.target.classList.contains('ci-inc')) state.items[i].qty += 1;
  else if(ev.target.classList.contains('ci-dec')) { state.items[i].qty -= 1; if(state.items[i].qty<=0) state.items.splice(i,1); }
  else if(ev.target.tagName==='BUTTON') state.items.splice(i,1);
  updateCartSummary();
});

// ======== Catálogo (API + caché local 5 min) ========
const MENU_API_URL = window.MENU_API_URL;
const CACHE_KEY = 'qbocao_catalog_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

document.addEventListener('DOMContentLoaded', async ()=>{
  // 1) mostrar instantáneo desde cache si existe y es reciente
  const cached = getCache();
  if(cached){ renderCatalog(cached); }
  // 2) de fondo, pedir a la API y actualizar si hay cambios
  const fresh = await fetchCatalog();
  if(fresh){ renderCatalog(fresh); setCache(fresh); }
});

function getCache(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    const {ts, items} = JSON.parse(raw);
    if(Date.now()-ts > CACHE_TTL_MS) return null;
    return items;
  }catch(_){ return null; }
}
function setCache(items){
  try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), items})); }catch(_){}
}

async function fetchCatalog(){
  if(!MENU_API_URL) return null;
  try{
    const res = await fetch(MENU_API_URL); // permitir cache del navegador
    const raw = await res.text();
    let data; try{ data = JSON.parse(raw); } catch(e){ console.error('API no-JSON', raw); return null; }
    if(!data || !Array.isArray(data.productos)) { console.error('JSON inesperado', data); return null; }

    let items = data.productos.map(normalizeFromAPI).filter(x=>x.nombre);
    const disponibles = items.filter(i=>i.activo);
    const agotados = items.filter(i=>!i.activo);
    return [...disponibles, ...agotados];
  }catch(e){ console.error('fetchCatalog error', e); return null; }
}

function normalizeFromAPI(row){
  // disponible puede venir true/false, "true"/"SI"/"Sí"
  const disp = (row.disponible===true) || String(row.disponible).toUpperCase()==='SI' || String(row.disponible).toLowerCase()==='true';
  const agot = (row.agotado===true) || String(row.agotado).toLowerCase()==='true';
  const activo = disp && !agot;
  return {
    id: String(row.id||''),
    nombre: String(row.nombre||'').trim(),
    descripcion: String(row.descripcion||'').trim(),
    precio: Number(row.precio)||0,
    activo,
    foto: String(row.imagen||'').trim()
  };
}

function renderCatalog(items){
  // si había skeletons, los reemplazamos
  const logoFallback = 'assets/images/logo.png';
  els.grid.innerHTML = items.map(it=>{
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
            <span class="price">${money(it.precio)}</span>
            <button class="btn btn-primary btn-add"
              data-id="${encodeURIComponent(it.id)}"
              data-name="${encodeURIComponent(it.nombre)}"
              data-price="${it.precio}" ${disabled}>Agregar</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Click en “Agregar”
els.grid?.addEventListener('click', ev=>{
  const btn = ev.target.closest('.btn-add'); if(!btn) return;
  if(btn.hasAttribute('disabled')) return;
  const id = decodeURIComponent(btn.dataset.id||'');
  const name = decodeURIComponent(btn.dataset.name||'');
  const price = Number(btn.dataset.price)||0;
  if(!id || !name) return;
  const exists = state.items.find(it=>it.id===id);
  if(exists) exists.qty += 1; else state.items.push({id,name,price,qty:1});
  updateCartSummary(); openCart();
});

function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

// (El cálculo de envío por km y el formulario van en el siguiente bloque)
