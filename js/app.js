// Q'bocao — Catálogo rápido + Carrito + Formulario con CP → costo envío + WhatsApp

const ORIGIN = { lat: 34.6335848, lng: -58.5979308 };
const MENU_API_URL = window.MENU_API_URL;
const WHATS_NUMBER = window.WHATS_NUMBER || '+5491154815519';

// ======= UI =======
const els = {
  cartPanel: document.getElementById('cartPanel'),
  backdrop: document.getElementById('backdrop'),
  openCart: document.getElementById('openCart'),
  closeCart: document.querySelector('#cartPanel .cart-close'),
  grid: document.getElementById('gridCatalogo'),

  // carrito
  cartBody: document.getElementById('stepCart'),
  subtotalEl: document.getElementById('subtotalTxt'),
  continueBtn: document.getElementById('btnToForm'),
  panelTitle: document.getElementById('panelTitle'),
  footerCart: document.getElementById('footerCart'),

  // form
  stepForm: document.getElementById('stepForm'),
  orderForm: document.getElementById('orderForm'),
  backBtn: document.getElementById('btnBack'),
  fNombre: document.getElementById('fNombre'),
  fApellido: document.getElementById('fApellido'),
  fTelefono: document.getElementById('fTelefono'),
  fRetiro: document.getElementById('fRetiro'),
  direccionBlock: document.getElementById('direccionBlock'),
  fCalle: document.getElementById('fCalle'),
  fCP: document.getElementById('fCP'),
  fTipo: document.getElementById('fTipo'),
  deptoExtra: document.getElementById('deptoExtra'),
  fPiso: document.getElementById('fPiso'),
  fDepto: document.getElementById('fDepto'),
  fPago: document.getElementById('fPago'),
  transferBlock: document.getElementById('transferBlock'),
  copyStatus: document.getElementById('copyStatus'),
  rSubtotal: document.getElementById('rSubtotal'),
  rEnvio: document.getElementById('rEnvio'),
  rTotal: document.getElementById('rTotal')
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
const state = { items: [], shipping: 0 };
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

// Ir al formulario
els.continueBtn?.addEventListener('click', ()=>{
  els.panelTitle.textContent = 'Completar datos';
  els.cartBody.hidden = true;
  els.footerCart.hidden = true;
  els.stepForm.hidden = false;
  // setear resumen
  const subtotal = state.items.reduce((a,it)=>a+it.price*it.qty,0);
  els.rSubtotal.textContent = money(subtotal);
  calcShipping(); // inicializa envío (puede ser 0 si no hay CP)
  updateTotals();
});

// Volver al carrito
els.backBtn?.addEventListener('click', ()=>{
  els.panelTitle.textContent = 'Tu pedido';
  els.stepForm.hidden = true;
  els.cartBody.hidden = false;
  els.footerCart.hidden = false;
});

// ======= Catálogo (con caché) =======
const CACHE_KEY = 'qbocao_catalog_v3';
const CACHE_TTL_MS = 5 * 60 * 1000;

document.addEventListener('DOMContentLoaded', async ()=>{
  const cached = getCache();
  if (cached?.items?.length) renderCatalog(cached.items, true);
  const fresh = await fetchCatalog();
  if (fresh && (!cached || cached.updated !== fresh.updated)) {
    renderCatalog(fresh.items, false);
    setCache(fresh.updated, fresh.items);
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

async function fetchCatalog(){
  if(!MENU_API_URL) return null;
  try{
    const res = await fetch(MENU_API_URL);
    const raw = await res.text();
    let data; try{ data = JSON.parse(raw); } catch(e){ console.error('API no-JSON', raw); return null; }
    if(!data || !Array.isArray(data.productos)) { console.error('JSON inesperado', data); return null; }
    let items = data.productos.map(normalizeFromAPI).filter(x=>x.nombre);
    const disponibles = items.filter(i=>i.activo);
    const agotados = items.filter(i=>!i.activo);
    items = [...disponibles, ...agotados];
    return { updated: String(data.updated||''), items };
  }catch(e){ console.warn('fetchCatalog err', e); return null; }
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

function renderCatalog(items){
  const logoFallback = 'assets/images/logo.png';
  els.grid.innerHTML = items.map(it=>{
    const agotado = !it.activo;
    const disabled = agotado ? 'disabled' : '';
    const badge = agotado ? `<span class="badge-out">AGOTADO</span>` : '';
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

// ======= Formulario dinámico =======
els.fTipo?.addEventListener('change', ()=>{
  const isDepto = els.fTipo.value === 'depto';
  els.deptoExtra.hidden = !isDepto;
});
els.fRetiro?.addEventListener('change', ()=>{
  const retiro = els.fRetiro.checked;
  els.direccionBlock.hidden = retiro;
  state.shipping = 0;
  updateTotals();
});

// Pago → mostrar Alias/CBU + copiar
els.fPago?.addEventListener('change', ()=>{
  const show = els.fPago.value === 'transferencia';
  els.transferBlock.hidden = !show;
});
document.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('[data-copy]'); if(!btn) return;
  const sel = btn.getAttribute('data-copy');
  const input = document.querySelector(sel);
  if(!input) return;
  input.select(); input.setSelectionRange(0, 99999);
  try{ document.execCommand('copy'); els.copyStatus.textContent = 'Copiado ✅'; }
  catch(_){ els.copyStatus.textContent = 'No se pudo copiar'; }
  setTimeout(()=>{ els.copyStatus.textContent=''; }, 1500);
});

// ======= Envío por CP (CSV data/envio_zonas.csv) =======
let ZONAS = null;
async function loadZonas(){
  try{
    const res = await fetch('data/envio_zonas.csv', { cache:'no-store' });
    const text = await res.text();
    const parsed = Papa.parse(text.trim(), { header:true, skipEmptyLines:true });
    ZONAS = parsed.data.map(r => ({
      cp: String(r.CP||'').trim(),
      envio: Number(String(r.Envio||'').replace(/[^\d.,]/g,'').replace(',','.')) || 0
    }));
  }catch(_){ ZONAS = []; }
}
loadZonas();

['keyup','change'].forEach(evt=>{
  els.fCP?.addEventListener(evt, ()=>{ calcShipping(); updateTotals(); });
});

function calcShipping(){
  if(els.fRetiro.checked){ state.shipping = 0; return; }
  const cp = String(els.fCP.value||'').trim();
  if(!cp || !ZONAS || !ZONAS.length){ state.shipping = 0; return; }
  const z = ZONAS.find(z => z.cp === cp);
  state.shipping = z ? z.envio : 0;
}

function updateTotals(){
  const subtotal = state.items.reduce((a,it)=>a+it.price*it.qty,0);
  els.rSubtotal.textContent = money(subtotal);
  els.rEnvio.textContent = money(state.shipping||0);
  els.rTotal.textContent = money(subtotal + (state.shipping||0));
}

// ======= Enviar por WhatsApp =======
els.orderForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  if(state.items.length===0) { alert('El carrito está vacío.'); return; }

  const nombre = els.fNombre.value.trim();
  const apellido = els.fApellido.value.trim();
  const tel = els.fTelefono.value.trim();
  const retiro = els.fRetiro.checked;

  if(!nombre || !apellido || !tel){ alert('Completá nombre, apellido y teléfono.'); return; }

  let direccion = 'Retiro en local';
  if(!retiro){
    const calle = els.fCalle.value.trim();
    const cp = els.fCP.value.trim();
    if(!calle || !cp){ alert('Completá calle y código postal.'); return; }
    direccion = `${calle} (CP ${cp})`;
    if(els.fTipo.value === 'depto'){
      const piso = els.fPiso.value.trim(); const dpto = els.fDepto.value.trim();
      if(piso) direccion += `, Piso ${piso}`;
      if(dpto) direccion += `, Dpto ${dpto}`;
    }
  }

  const pago = els.fPago.value;
  const subtotal = state.items.reduce((a,it)=>a+it.price*it.qty,0);
  const envio = state.shipping || 0;
  const total = subtotal + envio;

  const lista = state.items.map(it => `• ${it.name} x${it.qty} — $${(it.price*it.qty).toLocaleString('es-AR')}`).join('%0A');
  let texto = `Hola Q'bocao! Quiero hacer este pedido:%0A%0A${lista}%0A%0ASubtotal: $${subtotal.toLocaleString('es-AR')}`;
  texto += `%0AEnvío: $${envio.toLocaleString('es-AR')}`;
  texto += `%0ATotal: $${total.toLocaleString('es-AR')}%0A%0A`;
  texto += `Datos:%0A${nombre} ${apellido} — ${encodeURIComponent(tel)}%0A`;
  texto += `Dirección: ${encodeURIComponent(direccion)}%0A`;
  texto += `Pago: ${pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}`;

  const url = `https://wa.me/${encodeURIComponent(WHATS_NUMBER)}?text=${texto}`;
  window.open(url, '_blank');
});

// Utilidad
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
