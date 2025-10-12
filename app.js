/* Config + logic (rebuilt trimmed) */
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
const el = (s,c=document)=>c.querySelector(s);

function parseValue(raw){
  if(raw == null) return NaN;
  const s = String(raw).trim().replace(',', '.').replace(/[^0-9.+\-eE]/g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

const STORAGE_NS = 'baeder:last-values:v2';
function loadCache(){ try{ return JSON.parse(localStorage.getItem(STORAGE_NS) || '{}'); }catch{ return {}; } }
function saveCache(c){ try{ localStorage.setItem(STORAGE_NS, JSON.stringify(c)); }catch{} }
function writeStore(poolKey, tileKey, v, at){ const c=loadCache(); c[poolKey]=c[poolKey]||{}; c[poolKey][tileKey]={v,at:at?new Date(at).toISOString():null}; saveCache(c); }
function readStore(poolKey, tileKey){ const c=loadCache(); return (c[poolKey] && c[poolKey][tileKey]) || null; }

function displayName(key, name){
  if(key==='kids') return 'Kinder&shy;plansch&shy;becken';
  if(key==='swim') return 'Schwimmer&shy;becken';
  if(key==='out')  return 'Außen&shy;temperatur';
  return name;
}
function iconFor(key){ switch(key){ case 'swim':return '🏊'; case 'kids':return '👶'; case 'out':return '🌡️'; case 'uv':return '☀️'; default:return '•'; } }
function labelHTML(t){
  const name = displayName(t.key, t.name); const icon = iconFor(t.key);
  if(t.key==='uv'){ return `<span class="icon block" aria-hidden="true">${icon}</span><span class="text">${name}</span>`; }
  return `<span class="icon" aria-hidden="true">${icon}</span> ${name}`;
}

function buildGrid(poolKey){
  const grid = el(`#${poolKey}-grid`);
  const tiles = CONFIG[poolKey].tiles;
  grid.innerHTML = tiles.map(t => `
    <article class="thumb" id="${poolKey}-tile-${t.key}">
      <div class="label">${labelHTML(t)}</div>
      <div class="value"><span id="${poolKey}-val-${t.key}"></span><span class="unit">${t.unit||''}</span></div>
      <div class="meta" id="${poolKey}-meta-${t.key}"></div>
    </article>
  `).join('');
}

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
    try{ const r=await fetchLatest(cfg.channelId,cfg.readApiKey,t); return {t,...r}; }
    catch{ return {t,value:null,at:null,err:true}; }
  }));
  for(const r of results){
    const tileEl = document.getElementById(`${poolKey}-tile-${r.t.key}`);
    const vEl = document.getElementById(`${poolKey}-val-${r.t.key}`);
    let val = (r.value != null && !Number.isNaN(r.value)) ? r.value : null;
    if(val == null){ const stored = readStore(poolKey, r.t.key); if(stored && stored.v != null && !Number.isNaN(stored.v)) val = stored.v; }
    else{ writeStore(poolKey, r.t.key, val, r.at || null); }
    vEl.textContent = (val==null)?'': nf1.format(val);
  }
}

// UV modal open/close
function openUvModal(){ const m=document.getElementById('uv-modal'); if(!m) return; m.classList.add('show'); const d=m.querySelector('.modal-dialog'); if(d) d.focus(); }
function closeUvModal(){ const m=document.getElementById('uv-modal'); if(!m) return; m.classList.remove('show'); }
document.addEventListener('click',(e)=>{ if(e.target.closest('[data-close="uv"]')){ closeUvModal(); return; } const a=e.target.closest('article.thumb'); if(a && /-tile-uv$/.test(a.id)){ openUvModal(); }});
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeUvModal(); });

// Bootstrap from latest.json for first-time visitors
async function primeFromGlobal(){
  try{
    const res = await fetch('latest.json', { cache:'no-store' }); if(!res.ok) return;
    const snapshot = await res.json();
    try{ buildGrid('filple'); }catch{}
    try{ buildGrid('natur'); }catch{}
    const apply = (poolKey, tileKey, rec)=>{
      if(!rec || rec.v==null || isNaN(rec.v)) return;
      writeStore(poolKey, tileKey, rec.v, rec.at||null);
      const vEl = document.getElementById(`${poolKey}-val-${tileKey}`);
      if(vEl) vEl.textContent = nf1.format(rec.v);
    };
    if(snapshot.filple){ for(const k of Object.keys(snapshot.filple)){ apply('filple',k,snapshot.filple[k]); } }
    if(snapshot.natur){ for(const k of Object.keys(snapshot.natur)){ apply('natur',k,snapshot.natur[k]); } }
  }catch{}
}

function refreshAll(){ updatePool('filple'); updatePool('natur'); }
window.addEventListener('DOMContentLoaded', async ()=>{ await primeFromGlobal(); refreshAll(); setInterval(refreshAll, 5*60*1000); });