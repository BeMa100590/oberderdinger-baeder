/* app.js – Ohne Vergangenheits-Funktionalität
   Oberderdingen – Alles zum Baden!
   ------------------------------------------------------------
   - Rendert Kacheln für Temperaturen & UV (FilpleBad, NaturErlebnisBad)
   - Setzt "Zuletzt aktualisiert"
   - Keine Historien-/Vergangenheits-Logik und keine History-Modals
   ------------------------------------------------------------ */

/** =========================
 *  KONFIG
 *  ========================= */
const LOCALE = "de-DE";

/** =========================
 *  DOM-Hooks
 *  ========================= */
const elFilpleGrid = document.getElementById("filple-grid");
const elNaturGrid  = document.getElementById("natur-grid");
const elFilpleUpd  = document.getElementById("filple-updated");
const elNaturUpd   = document.getElementById("natur-updated");

/** =========================
 *  SENSOR-SPEICHER
 *  =========================
 * Key => Zeitreihe [{ts, value}]
 * (nur für die Anzeige des aktuellen Werts genutzt)
 */
window.SENSOR_SERIES = window.SENSOR_SERIES || {};

/** =========================
 *  DATA PROVIDER (Demo)
 *  =========================
 * Stelle hier auf deine echte API um (fetch/axios etc.).
 */
const DataProvider = {
  // Beispiel für echte Daten:
  // async fetch(pool) {
  //   const res = await fetch(`/api/${pool}`);
  //   return await res.json();
  // },

  // Demo-Daten: generiert lauffähige Daten ohne Backend
  async fetch(pool) {
    const now = new Date();
    const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // nur wenige Tage zur Demo
    const series = (base, swing) => {
      const out = [];
      for (let t = new Date(start); t <= now; t = new Date(t.getTime() + 2*60*60*1000)) {
        const dailyPhase = Math.sin((t.getHours()/24) * Math.PI * 2);
        const noise = Math.sin((t.getTime()/3.6e6) * 1.7) * 0.3;
        out.push({ ts: t.toISOString(), value: base + swing * dailyPhase + noise });
      }
      return out;
    };

    return {
      updatedAt: now.toISOString(),
      tiles: [
        // Temperaturen
        {
          key: `${pool}:becken1:temp`,
          label: pool === "filple" ? "Filple – Becken 1" : "Natur – Schwimmerbecken",
          type: "temp",
          unit: "°C",
          series: series(pool === "filple" ? 23.5 : 21.8, 1.2)
        },
        {
          key: `${pool}:becken2:temp`,
          label: pool === "filple" ? "Filple – Kinderbecken" : "Natur – Nichtschwimmer",
          type: "temp",
          unit: "°C",
          series: series(pool === "filple" ? 26.0 : 22.6, 1.0)
        },
        // optionale Lufttemperatur
        {
          key: `${pool}:luft:temp`,
          label: pool === "filple" ? "Filple – Luft" : "Natur – Luft",
          type: "temp",
          unit: "°C",
          series: series(19.5, 4.5)
        },
        // UV-Index (zwei Positionen)
        {
          key: `${pool}:uv:außen`,
          label: pool === "filple" ? "Filple – UV außen" : "Natur – UV außen",
          type: "uv",
          unit: "",
          series: series(3.0, 2.2).map(p => ({...p, value: Math.max(0, Math.min(11, p.value))}))
        },
        {
          key: `${pool}:uv:innen`,
          label: pool === "filple" ? "Filple – UV innen" : "Natur – UV innen",
          type: "uv",
          unit: "",
          series: series(1.2, 0.8).map(p => ({...p, value: Math.max(0, Math.min(6, p.value))}))
        },
      ]
    };
  }
};

/** =========================
 *  UTIL
 *  ========================= */
function formatValue(val, unit) {
  if (val == null || Number.isNaN(val)) return "–";
  const digits = unit === "°C" ? 1 : 2;
  return `${val.toFixed(digits)}${unit ? " " + unit : ""}`;
}

function formatUpdated(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString(LOCALE, { day:"2-digit", month:"2-digit", year:"numeric" });
  const time = d.toLocaleTimeString(LOCALE, { hour:"2-digit", minute:"2-digit" });
  return `Zuletzt aktualisiert: ${date}, ${time} Uhr`;
}

/** =========================
 *  UI – RENDER
 *  ========================= */
function createCard({ key, label, value, unit, type }) {
  const card = document.createElement("div");
  card.className = "thumb-card";
  card.setAttribute("data-key", key);
  card.setAttribute("data-type", type);
  card.setAttribute("data-label", label);

  card.innerHTML = `
    <div class="thumb-top">
      <span class="thumb-label">${label}</span>
    </div>
    <div class="thumb-value">${formatValue(value, unit)}</div>
    <div class="thumb-meta">${type === "uv" ? "UV-Index" : "Temperatur"}</div>
  `;

  // Kein Klick-Handler für Historie mehr!
  return card;
}

function latestValue(series) {
  if (!series || !series.length) return null;
  return series[series.length - 1].value;
}

function renderPool(poolId, gridEl, updatedEl, data) {
  if (!gridEl || !updatedEl) return;

  gridEl.innerHTML = "";
  data.tiles.forEach(t => {
    window.SENSOR_SERIES[t.key] = t.series; // optional weiterhin abgelegt
    const val = latestValue(t.series);
    const card = createCard({
      key: t.key,
      label: t.label,
      value: val,
      unit: t.unit || (t.type === "temp" ? "°C" : ""),
      type: t.type
    });
    gridEl.appendChild(card);
  });

  updatedEl.textContent = formatUpdated(data.updatedAt);
}

/** =========================
 *  BOOTSTRAP
 *  ========================= */
async function init() {
  try {
    const filpleData = window.INIT_DATA_FILPLE || await DataProvider.fetch("filple");
    const naturData  = window.INIT_DATA_NATUR  || await DataProvider.fetch("natur");

    renderPool("filple", elFilpleGrid, elFilpleUpd, filpleData);
    renderPool("natur",  elNaturGrid,  elNaturUpd,  naturData);
  } catch (err) {
    console.error("Init-Fehler:", err);
    [elFilpleUpd, elNaturUpd].forEach(el => {
      if (el) el.textContent = "Fehler beim Laden der Daten.";
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
