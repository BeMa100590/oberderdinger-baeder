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

// Letzte gültige Werte & Zeitstempel je Feld
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

// ---------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------

function celsius(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}°C`;
}

function parseTs(tsStr) {
  if (!tsStr) return null;
  const d = new Date(tsStr); // ISO mit Z
  return isNaN(d.getTime()) ? null : d;
}

function fmt(d) {
  return d
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;
}

// Holt für EIN Feld den letzten Eintrag (unabhängig von anderen Feldern!)
async function fetchFieldLast(channelId, readKey, fieldNo) {
  const url =
    `https://api.thingspeak.com/channels/${channelId}/fields/${fieldNo}/last.json` +
    `?api_key=${readKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  const fieldName = `field${fieldNo}`;
  return {
    raw: data[fieldName] ?? null,
    ts: parseTs(data.created_at)
  };
}

// Schreibt Wert ins DOM, lässt alten stehen wenn neuer ungültig ist
function applyValue(elId, valueKey, tsKey, info) {
  const el = qs(elId);
  if (!el) return;

  const formatted = celsius(info?.raw ?? null);

  if (formatted !== null) {
    // gültiger neuer Wert
    STATE.values[valueKey] = formatted;
    STATE.ts[tsKey] = info.ts || STATE.ts[tsKey];
    el.textContent = formatted;
  } else if (STATE.values[valueKey] !== null) {
    // kein neuer, aber alter vorhanden -> alten anzeigen
    el.textContent = STATE.values[valueKey];
  } else {
    // noch nie ein gültiger Wert
    el.textContent = "–";
  }
}

// jüngsten Zeitstempel aus mehreren Feldern bestimmen
function latestTs(keys) {
  const arr = keys
    .map(k => STATE.ts[k])
    .filter(Boolean)
    .sort((a, b) => b - a);
  return arr[0] || null;
}

// Zeitstempel je Bad setzen
function updateTimestampDisplays() {
  const filpleEl = qs('#filple_updated');
  const naturEl = qs('#natur_updated');

  const filpleD = latestTs(['filple_schwimmer', 'filple_kinder', 'filple_aussen']);
  const naturD = latestTs(['natur_wasser', 'natur_aussen']);

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

// ---------------------------------------------------------
// Haupt-Update: pro Feld der "last.json"-Wert
// ---------------------------------------------------------

async function updateAll() {
  try {
    // Alle Felder parallel holen
    const [
      filpleSchw,
      filpleKind,
      naturWasser,
      filpleAussen,
      naturAussen
    ] = await Promise.all([
      fetchFieldLast(CONFIG.wasser.channelId, CONFIG.wasser.readKey, 1),
      fetchFieldLast(CONFIG.wasser.channelId, CONFIG.wasser.readKey, 2),
      fetchFieldLast(CONFIG.wasser.channelId, CONFIG.wasser.readKey, 3),
      fetchFieldLast(CONFIG.aussen.channelId, CONFIG.aussen.readKey, 1),
      fetchFieldLast(CONFIG.aussen.channelId, CONFIG.aussen.readKey, 2),
    ]);

    // Filplebad
    applyValue('#filple_schwimmer', 'filple_schwimmer', 'filple_schwimmer', filpleSchw);
    applyValue('#filple_kinder',    'filple_kinder',    'filple_kinder',    filpleKind);
    applyValue('#filple_aussen',    'filple_aussen',    'filple_aussen',    filpleAussen);

    // Naturerlebnisbad
    applyValue('#natur_wasser', 'natur_wasser', 'natur_wasser', naturWasser);
    applyValue('#natur_aussen', 'natur_aussen', 'natur_aussen', naturAussen);

    updateTimestampDisplays();

  } catch (err) {
    console.error(err);
    // Bei Fehlern: Werte NICHT löschen, nur Hinweis
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

// ---------------------------------------------------------
// Start
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = qs('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
