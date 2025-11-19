// ThingSpeak config
const CONFIG = {
  wasser: {
    channelId: 3089969,
    readKey: "G93FDQPXIJ75KSOR",
    // field1: Schwimmerbecken Filplebad
    // field2: Kinderplanschbecken Filplebad
    // field3: Naturerlebnisbad Flehingen (Wasser)
  },
  aussen: {
    channelId: 3094234,
    readKey: "OZU6XCJ29SCQTLQT",
    // field1: Außentemperatur Filplebad
    // field2: Außentemperatur Naturbad
  },
  refreshMs: 5 * 60 * 1000
};

const qs = (sel) => document.querySelector(sel);

// Interner Zustand
const STATE = {
  values: {
    filple_schwimmer: null,
    filple_kinder: null,
    filple_aussen: null,

    natur_wasser: null,
    natur_aussen: null,
  },
  ts: {
    filple_wasser: null,
    filple_aussen: null,

    natur_wasser: null,
    natur_aussen: null,
  }
};

// Formatierung
function celsius(val){
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}°C`;
}

function parseTs(tsStr){
  if (!tsStr) return null;
  const d = new Date(tsStr);
  return isNaN(d.getTime()) ? null : d;
}
function fmt(d){
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
}

// API-Abfrage
async function fetchLatest(channelId, readKey){
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

// Setzt Werte + behält alte bei Fehlern
function setIfValid(elId, stateKey, rawValue){
  const formatted = celsius(rawValue);

  if (formatted !== null) {
    STATE.values[stateKey] = formatted;
    qs(elId).textContent = formatted;
  } else if (STATE.values[stateKey] !== null) {
    qs(elId).textContent = STATE.values[stateKey];
  }
}

// Zeitanzeigen je Bad
function updateTimestampDisplays(){
  const filpleEl = qs('#filple_updated');
  const naturEl  = qs('#natur_updated');

  // Filplebad: Wasser oder Außen – letzter gültiger
  const filpleD =
    STATE.ts.filple_wasser ||
    STATE.ts.filple_aussen;

  // Naturbad: Wasser oder Außen – letzter gültiger
  const naturD =
    STATE.ts.natur_wasser ||
    STATE.ts.natur_aussen;

  if (filpleD) filpleEl.textContent = `Letzte Messung: ${fmt(filpleD)}`;
  if (naturD)  naturEl.textContent  = `Letzte Messung: ${fmt(naturD)}`;
}

// Hauptupdate
async function updateAll(){
  try{
    const [wasser, aussen] = await Promise.all([
      fetchLatest(CONFIG.wasser.channelId, CONFIG.wasser.readKey),
      fetchLatest(CONFIG.aussen.channelId, CONFIG.aussen.readKey)
    ]);

    // Wasser
    const w = wasser.feeds?.[0] || {};
    const wTs = parseTs(w.created_at);

    if (wTs) {
      STATE.ts.filple_wasser = wTs;
      STATE.ts.natur_wasser  = wTs;
    }

    setIfValid('#filple_schwimmer', 'filple_schwimmer', w.field1);
    setIfValid('#filple_kinder',    'filple_kinder',    w.field2);
    setIfValid('#natur_wasser',     'natur_wasser',     w.field3);

    // Außen
    const a = aussen.feeds?.[0] || {};
    const aTs = parseTs(a.created_at);

    if (aTs) {
      STATE.ts.filple_aussen = aTs;
      STATE.ts.natur_aussen  = aTs;
    }

    setIfValid('#filple_aussen', 'filple_aussen', a.field1);
    setIfValid('#natur_aussen',  'natur_aussen',  a.field2);

    // Zeitupdates
    updateTimestampDisplays();

  }catch(err){
    console.error(err);

    ['#filple_updated','#natur_updated'].forEach(id => {
      const el = qs(id);
      el.title = 'Fehler beim Laden. Letzte gültige Werte werden angezeigt.';
      if (!el.textContent || el.textContent.includes('Lade'))
        el.textContent = 'Letzte Messung: –';
    });
  }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
  qs('#year').textContent = new Date().getFullYear();
  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
