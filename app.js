/* Oberderdinger Bäder – Thumbnails + ThingSpeak + Persistenz
   Channels:
     Wasser: ID 3089969, Key G93FDQPXIJ75KSOR
       - Filple: swim=1, kids=2
       - Natur:  swim=3, kids=3
     Außen:  ID 3094234, Key OZU6XCJ29SCQTLQT
       - Filple: out=1
       - Natur:  out=2
     UV:     ID 3043993, Key 5QKSO8HZ6BNPFTDE
       - Beide: uv=5
*/
const CONFIG = {
  filple: {
    channelId: 3089969,
    readApiKey: "G93FDQPXIJ75KSOR",
    tiles: [
      { key:'swim', name:'Schwimmerbecken',     field: 1, unit:'°C' },
      { key:'kids', name:'Kinderplanschbecken', field: 2, unit:'°C' },
      { key:'out',  name:'Außentemperatur',     field: 1, unit:'°C', channelId: 3094234, readApiKey: "OZU6XCJ29SCQTLQT" },
      { key:'uv',   name:'UV-Index',            field: 5, unit:'',   channelId: 3043993, readApiKey: "5QKSO8HZ6BNPFTDE" }
    ]
  },
  natur: {
    channelId: 3089969,
    readApiKey: "G93FDQPXIJ75KSOR",
    tiles: [
      { key:'swim', name:'Schwimmerbecken',     field: 3, unit:'°C' },
      { key:'kids', name:'Kinderplanschbecken', field: 3, unit:'°C' },
      { key:'out',  name:'Außentemperatur',     field: 2, unit:'°C', channelId: 3094234, readApiKey: "OZU6XCJ29SCQTLQT" },
      { key:'uv',   name:'UV-Index',            field: 5, unit:'',   channelId: 3043993, readApiKey: "5QKSO8HZ6BNPFTDE" }
    ]
  }
};

const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const tf  = new Intl.DateTimeFormat('de-DE', { dateStyle:'medium', timeStyle:'short' });

const el = (s,c=document)=>c.querySelector(s);

// Robust parser: handles commas and stray chars
function parseValue(raw){
  if(raw == null) return NaN;
  const s = String(raw).trim().replace(',', '.').replace(/[^0-9.+\-eE]/g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

// Store last values locally
const STORAGE_NS = 'baeder:last-values:v2';
function loadCache(){ try{ return JSON.parse(localStorage.getItem(STORAGE_NS) || '{}'); }catch{ return {}; } }
function saveCache(c){ try{ localStorage.setItem(STORAGE_NS, JSON.stringify(c)); }catch{} }
function writeStore(poolKey, tileKey, v, at){
  const c = loadCache(); c[poolKey] = c[poolKey] || {}; c[poolKey][tileKey] = { v, at: at ? new Date(at).toISOString() : null }; saveCache(c);
}
function readStore(poolKey, tileKey){
  const c = loadCache(); return (c[poolKey] && c[poolKey][tileKey]) || null;
}

function iconFor(key){
  switch(key){
    case 'swim': return '🏊';
    case 'kids': return '👶';
    case 'out':  return '🌡️';
    case 'uv':   return '☀️';
    default:     return '•';
  }
}

function uvClass(v){
  if(v==null || isNaN(v)) return '';
  if(v < 3)  return 'uv-low';
  if(v < 6)  return 'uv-mod';
  if(v < 8)  return 'uv-high';
  if(v < 11) return 'uv-very-high';
  return 'uv-extreme';
}

function fmtValue(tileKey, v){ if(v==null || isNaN(v)) return ''; return nf1.format(v); }

function buildGrid(poolKey){
  const grid = el(`#${poolKey}-grid`);
  const tiles = CONFIG[poolKey].tiles;
  grid.innerHTML = tiles.map(t => `
    <article class="thumb" id="${poolKey}-tile-${t.key}">
      <div class="label"><span class="icon" aria-hidden="true">${iconFor(t.key)}</span> ${t.name}</div>
      <div class="value"><span id="${poolKey}-val-${t.key}"></span><span class="unit">${t.unit||''}</span></div>
      <div class="meta" id="${poolKey}-meta-${t.key}"></div>
    </article>
  `).join('');
}

// Fetch last numeric value for given tile (tile can override channel/key)
async function fetchLatest(defaultChannelId, defaultReadKey, tile){
  const channelId = tile.channelId ?? defaultChannelId;
  const readKey   = tile.readApiKey ?? defaultReadKey;
  const field     = tile.field ?? null;
  if(field == null) return { value:null, at:null, skipped:true };

  const url = new URL(`https://api.thingspeak.com/channels/${channelId}/fields/${field}.json`);
  url.searchParams.set('results', '120');
  if(readKey) url.searchParams.set('api_key', readKey);

  const res = await fetch(url.toString());
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const feeds = data.feeds || [];
  const key = `field${field}`;
  for(let i=feeds.length-1;i>=0;i--){
    const v = parseValue(feeds[i][key]);
    if(!Number.isNaN(v)) return { value:v, at:feeds[i].created_at };
  }
  return { value:null, at:null };
}

async function updatePool(poolKey){
  const cfg = CONFIG[poolKey];
  buildGrid(poolKey);
  const results = await Promise.all(cfg.tiles.map(async t => {
    try{ const r = await fetchLatest(cfg.channelId, cfg.readApiKey, t); return { t, ...r }; }
    catch{ return { t, value:null, at:null, err:true }; }
  }));

  for(const r of results){
    const tileEl = document.getElementById(`${poolKey}-tile-${r.t.key}`);
    const vEl = document.getElementById(`${poolKey}-val-${r.t.key}`);
    const mEl = document.getElementById(`${poolKey}-meta-${r.t.key}`);

    // choose value: prefer fresh, else stored
    let val = (r.value != null && !Number.isNaN(r.value)) ? r.value : null;
    if(val == null){
      const stored = readStore(poolKey, r.t.key);
      if(stored && stored.v != null && !Number.isNaN(stored.v)) val = stored.v;
    }else{
      writeStore(poolKey, r.t.key, val, r.at || null);
    }

    vEl.textContent = fmtValue(r.t.key, val);
    mEl.textContent = ''; // no timestamps
    if(r.t.key === 'uv'){
      const cls = uvClass(val);
      tileEl.classList.remove('uv-low','uv-mod','uv-high','uv-very-high','uv-extreme');
      if(cls) tileEl.classList.add(cls);
    }
  }
}

// Bootstrap from latest.json so first-time visitors see values immediately
async function primeFromGlobal(){
  try{
    const res = await fetch('latest.json', { cache: 'no-store' });
    if(!res.ok) return;
    const snapshot = await res.json();
    // ensure grids exist
    try { buildGrid('filple'); } catch{}
    try { buildGrid('natur'); } catch{}
    const apply = (poolKey, tileKey, rec) => {
      if(!rec || rec.v == null || isNaN(rec.v)) return;
      writeStore(poolKey, tileKey, rec.v, rec.at || null);
      const vEl = document.getElementById(`${poolKey}-val-${tileKey}`);
      const tileEl = document.getElementById(`${poolKey}-tile-${tileKey}`);
      if(vEl) vEl.textContent = fmtValue(tileKey, rec.v);
      if(tileKey==='uv' && tileEl){
        const cls = uvClass(rec.v);
        tileEl.classList.remove('uv-low','uv-mod','uv-high','uv-very-high','uv-extreme');
        if(cls) tileEl.classList.add(cls);
      }
    };
    if(snapshot.filple){ for(const k of Object.keys(snapshot.filple)){ apply('filple', k, snapshot.filple[k]); } }
    if(snapshot.natur){  for(const k of Object.keys(snapshot.natur)){  apply('natur',  k, snapshot.natur[k]);  } }
  }catch{}
}

function refreshAll(){ updatePool('filple'); updatePool('natur'); }

window.addEventListener('DOMContentLoaded', async ()=>{
  await primeFromGlobal();
  refreshAll();
  setInterval(refreshAll, 5*60*1000);
});

function openUvModal(){
  const m = document.getElementById('uv-modal'); if(!m) return;
  m.classList.add('show');
  const d = m.querySelector('.modal-dialog'); if(d) d.focus();
}
function closeUvModal(){
  const m = document.getElementById('uv-modal'); if(!m) return;
  m.classList.remove('show');
}
// Event delegation for opening on UV tiles and closing on backdrop/close
document.addEventListener('click', (e)=>{
  if(e.target.closest('[data-close="uv"]')){ closeUvModal(); return; }
  const article = e.target.closest('article.thumb');
  if(article && /-tile-uv$/.test(article.id)){ openUvModal(); }
});
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeUvModal(); });
