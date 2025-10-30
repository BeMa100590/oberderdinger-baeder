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

function celsius(val){
  if (val === null || val === undefined || val === "") return "–";
  const n = Number(val);
  if (Number.isNaN(n)) return "–";
  return `${n.toFixed(1)}°C`;
}

function formatTs(tsStr){
  if (!tsStr) return "Zeit unbekannt";
  // ThingSpeak timestamps are in UTC
  const d = new Date(tsStr + "Z");
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function fetchLatest(channelId, readKey){
  const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return data;
}

async function updateAll(){
  try{
    const [wasser, aussen] = await Promise.all([
      fetchLatest(CONFIG.wasser.channelId, CONFIG.wasser.readKey),
      fetchLatest(CONFIG.aussen.channelId, CONFIG.aussen.readKey)
    ]);

    // Wasserwerte
    const w = wasser.feeds?.[0] || {};
    qs('#filple_schwimmer').textContent = celsius(w.field1);
    qs('#filple_kinder').textContent   = celsius(w.field2);
    qs('#natur_wasser').textContent    = celsius(w.field3);
    qs('#filple_updated').textContent  = `Letzte Messung: ${formatTs(w.created_at)}`;

    // Außentemperatur
    const a = aussen.feeds?.[0] || {};
    qs('#filple_aussen').textContent = celsius(a.field1);
    qs('#natur_aussen').textContent  = celsius(a.field2);
    // Für Naturerlebnisbad dieselbe Zeit-info nutzen, falls getrennt – nimm neueste
    const latestTs = (b => b?.created_at)(a) || (b => b?.created_at)(w);
    qs('#natur_updated').textContent = `Letzte Messung: ${formatTs(latestTs)}`;

  }catch(err){
    console.error(err);
    const msg = 'Fehler beim Laden der Daten. Bitte später erneut versuchen.';
    ['#filple_updated','#natur_updated'].forEach(id => qs(id).textContent = msg);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  qs('#year').textContent = new Date().getFullYear();
  qs('#refreshBtn').addEventListener('click', updateAll);
  updateAll();
  setInterval(updateAll, CONFIG.refreshMs);
});
