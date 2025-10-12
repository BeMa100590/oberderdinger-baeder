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

const dfDay = new Intl.DateTimeFormat('de-DE', { weekday:'short' });
const dfDate = new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
function lastNDates(n){
  const out = [];
  const now = new Date();
  for(let i=0;i<n;i++){
    const d = new Date(now); d.setDate(now.getDate()-i);
    // normalize to local start of day
    d.setHours(0,0,0,0);
    out.push(new Date(d));
  }
  return out;
}
async function fetchDailyStats(channelId, readApiKey, field, days=7, mode='avg'){
  const url = new URL(`https://api.thingspeak.com/channels/${channelId}/fields/${field}.json`);
  url.searchParams.set('days', String(days));
  url.searchParams.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin');
  if(readApiKey) url.searchParams.set('api_key', readApiKey);
  const res = await fetch(url.toString());
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const feeds = data.feeds || [];
  // group by local YYYY-MM-DD
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
  const daysList = (function lastNDates(n){
    const out = []; const now = new Date();
    for(let i=0;i<n;i++){ const d=new Date(now); d.setDate(now.getDate()-i); d.setHours(0,0,0,0); out.push(new Date(d)); }
    return out;
  })(days);
  return daysList.map(d => {
    const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
    const b = bucket.get(key);
    let val = null;
    if(b){
      if(mode==='max') val = b.max;
      else            val = b.n>0 ? (b.sum / b.n) : null;
    }
    return { date:d, value: (val==null?null:val) };
  });
}
  // build last N days list (today first)
  const daysList = lastNDates(days);
  return daysList.map(d => {
    const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
    const b = bucket.get(key);
    const avg = b && b.n>0 ? (b.sum / b.n) : null;
    return { date:d, avg };
  });
}
function openHistoryModal(){
  const m = document.getElementById('history-modal'); if(!m) return;
  m.classList.add('show');
  const d = m.querySelector('.modal-dialog'); if(d) d.focus();
}
function closeHistoryModal(){
  const m = document.getElementById('history-modal'); if(!m) return;
  m.classList.remove('show');
}
async function showHistory(poolKey, tileKey){
  // find tile config
  const cfg = CONFIG[poolKey];
  if(!cfg) return;
  const t = cfg.tiles.find(x=>x.key===tileKey);
  if(!t) return;
  const channelId = t.channelId ?? cfg.channelId;
  const readKey   = t.readApiKey ?? cfg.readApiKey;
  if(!t.field){ return; }
  // fetch averages
  let items = [];
  try{
    items = await fetchDailyAverages(channelId, readKey, t.field, 7);
  }catch(e){
    // fallback: show empty list
    items = lastNDates(7).map(d=>({date:d, avg:null}));
  }
  // render
  const title = document.getElementById('history-title');
  const list  = document.getElementById('history-list');
  if(title) title.textContent = (poolKey==='filple' ? 'FilpleBad Oberderdingen – ' : 'NaturErlebnisBad Flehingen – ') + t.name;
  if(list){
    list.innerHTML = items.map(it => {
      const left = `${dfDay.format(it.date)} · ${dfDate.format(it.date)}`;
      const right = (it.avg==null) ? '–' : nf1.format(it.avg) + (t.unit||'');
      return `<li><span class="d">${left}</span><span class="v">${right}</span></li>`;
    }).join('');
  }
  openHistoryModal();
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
// Open history when clicking on numeric value area
document.addEventListener('click', (e)=>{
  const val = e.target.closest('.value[data-click="val"]'); if(!val) return;
  const art = val.closest('article.thumb'); if(!art) return;
  e.stopPropagation(); // prevent UV image modal on UV tile
  const id = art.id; // format: {pool}-tile-{key}
  const m = id.match(/^(filple|natur)-tile-(\w+)$/);
  if(m){ showHistory(m[1], m[2]); }
});
// Close history modal
document.addEventListener('click', (e)=>{ if(e.target.closest('[data-close="hist"]')){ closeHistoryModal(); } });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeHistoryModal(); });
