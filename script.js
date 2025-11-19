// ThingSpeak config
const CONFIG = {
  wasser: {
    channelId: 3089969,
    readKey: "G93FDQPXIJ75KSOR",
    // field1: Schwimmerbecken Filplebad
    // field2: Kinderplanschbecken Filplebad
    // field3: Wassertemperatur Naturerlebnisbad
  },
  aussen: {
    channelId: 3094234,
    readKey: "OZU6XCJ29SCQTLQT",
    // field1: Außentemperatur Filplebad
    // field2: Außentemperatur Naturerlebnisbad
  },
  refreshMs: 5 * 60 * 1000, // alle 5 Minuten
  results: 50               // so viele Einträge rückwärts prüfen
};

const qs = (sel) => document.querySelector(sel);

// Interner Zustand: letzte gültige Werte & Zeitstempel JE FELD
const STATE = {
  values: {
    filple_schwimmer: null,
    filple_kinder: null,
    filple_aussen: null,
    natur_wasser: null,
    natur_aussen: null,
  },
  ts: {
    filple_schwimmer: null,
    filple_kinder: null,
    filple_aussen: null,
    natur_wasser: null,
    natur_aussen: null,
  }
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function celsius(val){
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}°C`;
}

function parseTs(tsStr){
  if (!tsStr) return null;
  const d = new Date(tsStr); // ISO mit Z
  return isNaN(d.getTime()) ? null : d;
}

function fmt(d){
  return d
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;
}

// Holt MEHRERE Einträge von ThingSpeak
async function fetchFeeds(channelId, readKey, results){
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=${results}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

// Sucht in feeds von hinten den letzten gültigen Wert für ein Feld
function findLastValid(feeds, fieldName){
  for (let i = feeds.length - 1; i >= 0; i--) {
    const f = feeds[i];
    const formatted = celsius(f[fieldName]);
    if (formatted !== null) {
      return {
        value: formatted,
        ts: parseTs(f.created_at)
      };
    }
  }
  return { value: null, ts: null };
}

// Übernimmt einen gefundenen Wert ins DOM + STATE
function applyValue(elId, valueKey, tsKey, info){
  const el = qs(elId);
  if (!el) return;

  if (info.value !== null) {
    // neuer gültiger Wert
    STATE.values[valueKey] = info.value;
    STATE.ts[tsKey] = info.ts || STATE.ts[tsKey];
    el.textContent = info.value;
  } else if (STATE.values[valueKey] !== null) {
    // kein neuer, aber wir haben einen alten
    el.textContent = STATE.values[valueKey];
  } else {
    // noch nie ein gültiger Wert
    el.textContent = "–";
  }
}

// liefert das jüngste Datum aus mehreren TS-Feldern
function latestTs(keys){
  const arr = keys
    .map(k => STATE.ts[k])
    .filter(Boolean)
    .sort((a, b) => b - a); // neuestes zuerst
  return arr[0] || null;
}

// Zeitstempel-Anzeige pro Bad
function updateTimestampDisplays(){
  const filpleEl = qs('#filple_updated');
  const naturEl  = qs('#natur_updated');

  const filpleD = latestTs(['filple_schwimmer', 'filple_kinder', 'filple_aussen']);
  const naturD  = latestTs(['natur_wasser', 'natur_aussen']);

  if (filpleEl) {
    filpleEl.textContent = filpleD
      ? `Letzte Messung: ${fmt(filpleD)}`
      : 'Letzte Messung: –';
  }

  if (naturEl) {
    naturEl.textContent = naturD
      ? `Letzte Messung: ${fmt(naturD)}`
      : 'Letzte Messung: –';
  }
}

// ---------------------------------------------------------------------------
// Haupt-Update
// ---------------------------------------------------------------------------

async function updateAll(){
  try {
    const [wasserJson, aussenJson] = await Promise.all([
      fetchFeeds(CONFIG.wasser.channelId, CONFIG.wasser.readKey, CONFIG.results),
      fetchFeeds(CONFIG.aussen.channelId, CONFIG.aussen.readKey, CONFIG.results)
    ]);

    const wFeeds = wasserJson.feeds || [];
    const aFeeds = aussenJson.feeds || [];

    // WASSERKANAL -----------------------------------------------------------
    const schwInfo  = findLastValid(wFeeds, "field1");
    const kindInfo  = findLastValid(wFeeds, "field2");
    const naturWInfo = findLastValid(wFeeds, "field3");

    applyValue('#filple_schwimmer', 'filple_schwimmer', 'filple_schwimmer', schwInfo);
    applyValue('#filple_kinder',    'filple_kinder',    'filple_kinder',    kindInfo);
    applyValue('#natur_wasser',     'natur_wasser',     'natur_wasser',     naturWInfo);

    // AUSSENKANAL -----------------------------------------------------------
    const filpleAInfo = findLastValid(aFeeds, "field1");
    const naturAInfo  = findLastValid(aFeeds, "field2");

    applyValue('#filple_aussen', 'filple_aussen', 'filple_aussen', filpleAInfo);
    applyValue('#natur_aussen',  'natur_aussen',  'natur_aussen',  naturAInfo);

    // Zeitstempel je Bad aktualisieren
    updateTimestampDisplays();

  } catch (err) {
    console.error(err);

    // Bei Fehlern: Hinweis im Title, Werte NICHT löschen
    ['#filple_updated', '#natur_updated'].forEach(id => {
      const el = qs(id);
      if (!el) return;
      el.title = 'Fehler beim Laden der Daten. Letzte gültige Werte werden angezeigt.';
      if (!el.textContent || el.textContent.includes('Lade')) {
        el.textContent = 'Letzte Messung: –';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = qs('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
