// Q'bocao — Catálogo desde API con caché por 'updated', timeout y render progresivo + carrito

const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };
const MENU_API_URL = window.MENU_API_URL;

// ======= UI =======
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

// ======= Carrito =======
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

// ======= Catálogo: caché por 'updated', timeout y render progresivo =======
const CACHE_KEY = 'qbocao_catalog_v2'; // incluye 'updated'
const CACHE_TTL_MS = 5 * 60 * 1000;     // 5 minutos
const FIRST_CHUNK = 8;                  // primeras tarjetas inmediatas
const NEXT_CHUNK = 12;                  // tamaño de cada lote posterior

document.addEventListener('DOMContentLoaded', async ()=>{
  const cached = getCache();
  if (cached?.items?.length) renderCatalogProgressive(cached.items);

  const fresh = await fetchCatalogWithTimeout(4500); // 4.5s timeout
  if (fresh && fresh.items?.length) {
    // si 'updated' no cambió, evitamos re-render innecesario
    if (!cached || cached.updated !== fresh.updated) {
      renderCatalogProgressive(fresh.items);
      setCache(fresh.updated, fresh.items);
    }
  }
});

function getCache(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(Date.now()-obj.ts > CACHE_TTL_MS) return null;
    return obj;
  }catch(_){ return null; }
}
function setCache(updated, items){
  try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), updated, items})); }catch(_){}
}

async function fetchCatalogWithTimeout(ms){
  if(!MENU_API_URL) return null;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  try{
    const res = await fetch(MENU_API_URL, { signal: ctrl.signal });
    const raw = await res.text();
    clearTimeout(t);
    let data; try{ data = JSON.parse(raw); } catch(e){ console.error('API no-JSON', raw); return null; }
    if(!data || !Array.isArray(data.productos)) { console.error('JSON inesperado', data); return null; }
    let items = data.productos.map(normalizeFromAPI).filter(x=>x.nombre);
    const disponibles = items.filter(i=>i.activo);
    const agotados = items.filter(i=>!i.activo);
    items = [...disponibles, ...agotados];
    return { updated: String(data.updated||''), items };
  }catch(e){
    console.warn('fetchCatalog timeout/err', e);
    return null;
  }
}

function normalizeFromAPI(row){
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

// Render en dos etapas: primeras N inmediatamente, el resto en lotes
function renderCatalogProgressive(items){
  const logoFallback = 'assets/images/logo.png';
  const makeCard = (it, i) => {
    const agotado = !it.activo;
    const badge = agotado ? `<span class="badge-out">AGOTADO</span>` : '';
    const disabled = agotado ? 'disabled' : '';
    const imgSrc = it.foto ? `assets/images/postres/${it.foto}` : logoFallback;
    const eager = i < 6 ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"';
    return `
      <article class="card">
        <figure class="figure">
          <img class="thumb" src="${imgSrc}" alt="${escapeHtml(it.nombre)}"
               ${eager} onerror="this.src='${logoFallback}'" />
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
  };

  // Limpia skeletons y renderiza primeras
  els.grid.innerHTML = items.slice(0, FIRST_CHUNK).map(makeCard).join('');

  // Resto en lotes para no bloquear el hilo
  let i = FIRST_CHUNK;
  const renderNext = () => {
    if (i >= items.length) return;
    const next = items.slice(i, i + NEXT_CHUNK).map((it, idx) => makeCard(it, i + idx)).join('');
    const frag = document.createElement('template');
    frag.innerHTML = next;
    els.grid.appendChild(frag.content);
    i += NEXT_CHUNK;
    // Dejar respirar el main thread
    if ('requestIdleCallback' in window) {
      requestIdleCallback(renderNext, { timeout: 200 });
    } else {
      setTimeout(renderNext, 16);
    }
  };
  renderNext();
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
