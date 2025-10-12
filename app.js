/* Oberderdinger Bäder – stable build v11
   - Thumbnails for both pools
   - ThingSpeak live values + localStorage persistence + latest.json bootstrap
   - UV modal (tap tile), 7‑Tage Liste (tap value): UV = Tagesmaximum, andere = Tagesdurchschnitt
*/
const CONFIG = {
  filple: {
    channelId: 3089969,
    readApiKey: "G93FDQPXIJ75KSOR",
    tiles: [
      { key:'swim', name:'Schwimmerbecken',     field: 1, unit:'°C' },
      { key:'kids', name:'Kinderplanschbecken', field: 2, unit:'°C' },
      { key:'out',  name:'Außen&shy;temperatur',field: 1, unit:'°C', channelId: 3094234, readApiKey: "OZU6XCJ29SCQTLQT" },
      { key:'uv',   name:'UV-Index',            field: 5, unit:'',   channelId: 3043993, readApiKey: "5QKSO8HZ6BNPFTDE" }
    ]
  },
  natur: {
    channelId: 3089969,
    readApiKey: "G93FDQPXIJ75KSOR",
    tiles: [
      { key:'swim', name:'Schwimmerbecken',     field: 3, unit:'°C' },
      { key:'kids', name:'Kinder&shy;plansch&shy;becken', field: 3, unit:'°C' },
      { key:'out',  name:'Außen&shy;temperatur',field: 2, unit:'°C', channelId: 3094234, readApiKey: "OZU6XCJ29SCQTLQT" },
      { key:'uv',   name:'UV-Index',            field: 5, unit:'',   channelId: 3043993, readApiKey: "5QKSO8HZ6BNPFTDE" }
    ]
  }
};

const nf1   = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const dfDay = new Intl.DateTimeFormat('de-DE', { weekday:'short' });
const dfDate= new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
const el    = (s,c=document)=>c.querySelector(s);

// Robust number parser (comma decimals ok)
function parseValue(raw){
  if(raw == null) return NaN;
  const s = String(raw).trim().replace(',', '.').replace(/[^0-9.+\-eE]/g, '');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

// Simple local cache
const STORAGE_NS = 'baeder:last-values:v3';
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
function labelHTML(t){
  const icon = iconFor(t.key);
  if(t.key==='uv'){
    // Icon allein, dann Label darunter
    return `<span class="icon block" aria-hidden="true">${icon}</span><span class="text">${t.name}</span>`;
  }
  return `<span class="icon" aria-hidden="true">${icon}</span> ${t.name}`;
}
function buildGrid(poolKey){
  const grid = el(`#${poolKey}-grid`);
  const tiles = CONFIG[poolKey].tiles;
  grid.innerHTML = tiles.map(t => `
    <article class="thumb" id="${poolKey}-tile-${t.key}">
      <div class="label">${labelHTML(t)}</div>
      <div class="value" data-click="val"><span id="${poolKey}-val-${t.key}"></span><span class="unit">${t.unit||''}</span></div>
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

function uvClass(v){
  if(v==null || isNaN(v)) return '';
  if(v < 3)  return 'uv-low';
  if(v < 6)  return 'uv-mod';
  if(v < 8)  return 'uv-high';
  if(v < 11) return 'uv-very-high';
  return 'uv-extreme';
}

async function updatePool(poolKey){
  try{
    const cfg = CONFIG[poolKey];
    buildGrid(poolKey);
    const results = await Promise.all(cfg.tiles.map(async t => {
      try{ const r = await fetchLatest(cfg.channelId, cfg.readApiKey, t); return { t, ...r }; }
      catch{ return { t, value:null, at:null, err:true }; }
    }));
    for(const r of results){
      const tileEl = document.getElementById(`${poolKey}-tile-${r.t.key}`);
      const vEl    = document.getElementById(`${poolKey}-val-${r.t.key}`);
      // choose value: prefer fresh then stored
      let val = (r.value != null && !Number.isNaN(r.value)) ? r.value : null;
      if(val == null){
        const stored = readStore(poolKey, r.t.key);
        if(stored && stored.v != null && !Number.isNaN(stored.v)) val = stored.v;
      }else{
        writeStore(poolKey, r.t.key, val, r.at || null);
      }
      if(vEl) vEl.textContent = (val==null) ? '' : nf1.format(val);
      if(r.t.key === 'uv' && tileEl){
        const cls = uvClass(val);
        tileEl.classList.remove('uv-low','uv-mod','uv-high','uv-very-high','uv-extreme');
        if(cls) tileEl.classList.add(cls);
      }
    }
  }catch(e){
    console.error("updatePool failed", poolKey, e);
  }
}

// Bootstrap: show latest.json values immediately for new visitors
async function primeFromGlobal(){
  try{
    const res = await fetch('latest.json', { cache: 'no-store' });
    if(!res.ok) return;
    const snapshot = await res.json();
    try { buildGrid('filple'); } catch{}
    try { buildGrid('natur'); } catch{}
    const apply = (poolKey, tileKey, rec) => {
      if(!rec || rec.v == null || isNaN(rec.v)) return;
      writeStore(poolKey, tileKey, rec.v, rec.at || null);
      const vEl = document.getElementById(`${poolKey}-val-${tileKey}`);
      const tileEl = document.getElementById(`${poolKey}-tile-${tileKey}`);
      if(vEl) vEl.textContent = nf1.format(rec.v);
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

// 7‑Tage Werte: avg (default), UV = max
async function fetchDailyStats(channelId, readApiKey, field, days=7, mode='avg'){
  const url = new URL(`https://api.thingspeak.com/channels/${channelId}/fields/${field}.json`);
  url.searchParams.set('days', String(days));
  url.searchParams.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin');
  if(readApiKey) url.searchParams.set('api_key', readApiKey);
  const res = await fetch(url.toString());
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const feeds = data.feeds || [];
  const bucket = new Map();
  for(const f of feeds){
    const v = parseValue(f[`field${field}`]);
    if(Number.isNaN(v)) continue;
    const dt = new Date(f.created_at);
    const local = new Date(dt.getTime());
    const key = local.getFullYear()+"-"+String(local.getMonth()+1).padStart(2,'0')+"-"+String(local.getDate()).padStart(2,'0');
    const b = bucket.get(key) || { sum:0, n:0, max:null, date:local };
    b.sum += v; b.n += 1; b.max = (b.max==null || v>b.max) ? v : b.max;
    bucket.set(key, b);
  }
  const out = [];
  const now = new Date();
  for(let i=0;i<days;i++){
    const d = new Date(now); d.setDate(now.getDate()-i); d.setHours(0,0,0,0);
    const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
    const b = bucket.get(key);
    let val = null;
    if(b){ val = (mode==='max') ? b.max : (b.n>0 ? (b.sum/b.n) : null); }
    out.push({ date:new Date(d), value: val });
  }
  return out;
}

// History modal
function openHistoryModal(){ const m=document.getElementById('history-modal'); if(!m) return; m.classList.add('show'); const d=m.querySelector('.modal-dialog'); if(d) d.focus(); }
function closeHistoryModal(){ const m=document.getElementById('history-modal'); if(!m) return; m.classList.remove('show'); }
async function showHistory(poolKey, tileKey){
  const cfg = CONFIG[poolKey]; if(!cfg) return;
  const t = cfg.tiles.find(x=>x.key===tileKey); if(!t || !t.field) return;
  const channelId = t.channelId ?? cfg.channelId;
  const readKey   = t.readApiKey ?? cfg.readApiKey;
  const mode = (tileKey==='uv') ? 'max' : 'avg';
  let items = [];
  try{ items = await fetchDailyStats(channelId, readKey, t.field, 7, mode); }
  catch{ items = []; }
  const title = document.getElementById('history-title');
  const list  = document.getElementById('history-list');
  if(title){
    const place = (poolKey==='filple' ? 'FilpleBad Oberderdingen' : 'NaturErlebnisBad Flehingen');
    const modeText = (mode==='max' ? 'Tagesmaximum' : 'Tagesdurchschnitt');
    title.textContent = `${place} – ${t.name} · 7 Tage (${modeText})`;
  }
  if(list){
    list.innerHTML = items.map(it => {
      const left  = `${dfDay.format(it.date)} · ${dfDate.format(it.date)}`;
      const right = (it.value==null) ? '–' : nf1.format(it.value) + (t.unit||'');
      return `<li><span class="d">${left}</span><span class="v">${right}</span></li>`;
    }).join('');
  }
  openHistoryModal();
}

// UV image modal
function openUvModal(){ const m=document.getElementById('uv-modal'); if(!m) return; m.classList.add('show'); const d=m.querySelector('.modal-dialog'); if(d) d.focus(); }
function closeUvModal(){ const m=document.getElementById('uv-modal'); if(!m) return; m.classList.remove('show'); }

// Global click handling
document.addEventListener('click', (e)=>{
  // Close modals
  if(e.target.closest('[data-close="uv"]'))   { closeUvModal(); return; }
  if(e.target.closest('[data-close="hist"]')) { closeHistoryModal(); return; }

  // History: click on value area
  const val = e.target.closest('.value[data-click="val"]');
  if(val){
    const art = val.closest('article.thumb'); if(!art) return;
    const m = art.id.match(/^(filple|natur)-tile-(\w+)$/);
    if(m){ showHistory(m[1], m[2]); }
    return;
  }

  // UV modal: click tile (but not value area due to early return above)
  const art = e.target.closest('article.thumb');
  if(art && /-tile-uv$/.test(art.id)){ openUvModal(); return; }
});
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ closeUvModal(); closeHistoryModal(); } });

function refreshAll(){ updatePool('filple'); updatePool('natur'); }

window.addEventListener('DOMContentLoaded', async ()=>{
  await primeFromGlobal();
  refreshAll();
  setInterval(refreshAll, 5*60*1000);
});