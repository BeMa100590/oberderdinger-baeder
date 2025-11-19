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
  refreshMs: 5 * 60 * 1000 // alle 5 Minuten
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

// Hilfsfunktionen ------------------------------------------------------------

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

async function fetchLatest(channelId, readKey){
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

// Ein Feld aktualisieren, aber bei ungültigen Werten den alten stehen lassen
function updateField(elId, valueKey, tsKey, rawValue, ts){
  const el = qs(elId);
  if (!el) return;

  const formatted = celsius(rawValue);

  if (formatted !== null) {
    // neuer gültiger Wert -> speichern & anzeigen
    STATE.values[valueKey] = formatted;
    el.textContent = formatted;
    if (ts) STATE.ts[tsKey] = ts;
  } else if (STATE.values[valueKey] !== null) {
    // kein neuer Wert, aber wir haben einen alten -> alten anzeigen
    el.textContent = STATE.values[valueKey];
  } else {
    // gar kein gültiger Wert bisher
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

  if (filpleD) filpleEl.textContent = `Letzte Messung: ${fmt(filpleD)}`;
  else         filpleEl.textContent = 'Letzte Messung: –';

  if (naturD)  naturEl.textContent  = `Letzte Messung: ${fmt(naturD)}`;
  else         naturEl.textContent  = 'Letzte Messung: –';
}

// Haupt-Update ---------------------------------------------------------------

async function updateAll(){
  try {
    const [wasser, aussen] = await Promise.all([
      fetchLatest(CONFIG.wasser.channelId, CONFIG.wasser.readKey),
      fetchLatest(CONFIG.aussen.channelId, CONFIG.aussen.readKey)
    ]);

    // WASSERKANAL -----------------------------------------------------------
    const w = wasser.feeds?.[0] || {};
    const wTs = parseTs(w.created_at);

    // Filplebad Wasser-Felder
    updateField('#filple_schwimmer', 'filple_schwimmer', 'filple_schwimmer', w.field1, wTs);
    updateField('#filple_kinder',    'filple_kinder',    'filple_kinder',    w.field2, wTs);

    // Naturbad Wasser
    updateField('#natur_wasser',     'natur_wasser',     'natur_wasser',     w.field3, wTs);

    // AUSSENKANAL -----------------------------------------------------------
    const a = aussen.feeds?.[0] || {};
    const aTs = parseTs(a.created_at);

    // Filplebad Außen
    updateField('#filple_aussen', 'filple_aussen', 'filple_aussen', a.field1, aTs);

    // Naturbad Außen
    updateField('#natur_aussen',  'natur_aussen',  'natur_aussen',  a.field2, aTs);

    // Zeitstempel je Bad
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

// Start ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = qs('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
