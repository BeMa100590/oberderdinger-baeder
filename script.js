// ThingSpeak config
const CONFIG = {
  wasser: {
    channelId: 3089969,
    readKey: "G93FDQPXIJ75KSOR",
    // field1: Schwimmerbecken Filplebad, field2: Kinderplanschbecken Filplebad, field3: Naturerlebnisbad Flehingen
  },
  aussen: {
    channelId: 3094234,
    readKey: "OZU6XCJ29SCQTLQT",
    // field1: Außentemperatur Filplebad, field2: Außentemperatur Naturerlebnisbad
  },
  refreshMs: 5 * 60 * 1000
};

const qs = (sel) => document.querySelector(sel);

// interner Zustand: letzte gültige Werte & Zeitstempel
const STATE = {
  values: {
    filple_schwimmer: null,
    filple_kinder: null,
    filple_aussen: null,
    natur_wasser: null,
    natur_aussen: null,
  },
  ts: {
    wasser: null,
    aussen: null,
  }
};

function celsius(val){
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}°C`;
}

function parseTs(tsStr){
  if (!tsStr) return null;
  const d = new Date(tsStr); // ThingSpeak liefert ISO, inkl. Z
  return isNaN(d.getTime()) ? null : d;
}
function fmt(d){
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
}

async function fetchLatest(channelId, readKey){
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

function setIfValid(elId, stateKey, maybeStrNumber){
  const formatted = celsius(maybeStrNumber);
  if (formatted !== null) {
    STATE.values[stateKey] = formatted;
    qs(elId).textContent = formatted;
  } else if (STATE.values[stateKey] !== null) {
    // Behalte den letzten gültigen Wert
    qs(elId).textContent = STATE.values[stateKey];
  }
}

function updateTimestampDisplays(){
  const filpleEl = qs('#filple_updated');
  const naturEl  = qs('#natur_updated');
  const filpleD = STATE.ts.wasser || STATE.ts.aussen;
  const naturD  = STATE.ts.aussen || STATE.ts.wasser;
  if (filpleD) filpleEl.textContent = `Letzte Messung: ${fmt(filpleD)}`;
  if (naturD)  naturEl.textContent  = `Letzte Messung: ${fmt(naturD)}`;
}

async function updateAll(){
  try{
    const [wasser, aussen] = await Promise.all([
      fetchLatest(CONFIG.wasser.channelId, CONFIG.wasser.readKey),
      fetchLatest(CONFIG.aussen.channelId, CONFIG.aussen.readKey)
    ]);

    // Wasserwerte
    const w = wasser.feeds?.[0] || {};
    setIfValid('#filple_schwimmer', 'filple_schwimmer', w.field1);
    setIfValid('#filple_kinder',    'filple_kinder',    w.field2);
    setIfValid('#natur_wasser',     'natur_wasser',     w.field3);
    const wTs = parseTs(w.created_at);
    if (wTs) STATE.ts.wasser = wTs;

    // Außentemperaturen
    const a = aussen.feeds?.[0] || {};
    setIfValid('#filple_aussen', 'filple_aussen', a.field1);
    setIfValid('#natur_aussen',  'natur_aussen',  a.field2);
    const aTs = parseTs(a.created_at);
    if (aTs) STATE.ts.aussen = aTs;

    updateTimestampDisplays();

  }catch(err){
    console.error(err);
    // Bei Fehlern Anzeige NICHT leeren – nur Hinweis im Title-Attribut
    ['#filple_updated','#natur_updated'].forEach(id => {
      const el = qs(id);
      el.title = 'Fehler beim Laden der Daten. Es bleibt der letzte gültige Wert sichtbar.';
      if (!el.textContent || el.textContent.includes('Lade')) {
        el.textContent = 'Letzte Messung: –';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  qs('#year').textContent = new Date().getFullYear();
  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
