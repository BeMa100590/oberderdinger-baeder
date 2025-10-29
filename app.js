/* app.js – Komplett
   Oberderdingen – Alles zum Baden!
   ------------------------------------------------------------
   Features
   - Rendert Kacheln für Temperaturen & UV (FilpleBad, NaturErlebnisBad)
   - Klick auf Kachel => Modal zeigt Tagesdurchschnitte (letzte 7 Tage)
   - "Zuletzt aktualisiert" pro Bad
   - Einfach auf echte API-Daten umstellbar (siehe DataProvider.fetch)
   ------------------------------------------------------------ */

/** =========================
 *  KONFIG
 *  ========================= */
const DAYS_HISTORY = 7;              // 7 / 14 / 28 – beliebig anpassen
const USE_UV_MAX_FOR_DAILY = false;  // true => UV Tages-Max statt Durchschnitt
const LOCALE = "de-DE";

/** =========================
 *  DOM-Hooks
 *  ========================= */
const elFilpleGrid = document.getElementById("filple-grid");
const elNaturGrid  = document.getElementById("natur-grid");
const elFilpleUpd  = document.getElementById("filple-updated");
const elNaturUpd   = document.getElementById("natur-updated");

const historyModal = document.getElementById("history-modal");
const historyTitle = document.getElementById("history-title");
const historyList  = document.getElementById("history-list");

/** =========================
 *  SENSOR-SPEICHER
 *  =========================
 * Key => Zeitreihe [{ts, value}]
 * Keys werden an Kacheln als data-key referenziert.
 */
window.SENSOR_SERIES = window.SENSOR_SERIES || {};

/** =========================
 *  DATA PROVIDER
 *  =========================
 * Stelle hier auf deine echte API um (fetch/axios etc.).
 */
const DataProvider = {
  // Beispiel: auf echte Endpunkte umstellen
  // async fetch(pool) {
  //   const res = await fetch(`/api/${pool}`);
  //   return await res.json();
  // },

  // Demo-Daten: deterministisch generiert, damit die App out-of-the-box funktioniert
  async fetch(pool) {
    // generiert Zeitreihen der letzten 30 Tage im 2h-Raster
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const series = (base, swing) => {
      const out = [];
      for (let t = new Date(start); t <= now; t = new Date(t.getTime() + 2*60*60*1000)) {
        const dailyPhase = Math.sin((t.getHours()/24) * Math.PI * 2);
        const noise = Math.sin((t.getTime()/3.6e6) * 1.7) * 0.3;
        out.push({ ts: t.toISOString(), value: base + swing * dailyPhase + noise });
      }
      return out;
    };

    // Pools: frei benennbar – wichtig sind die Keys
    const data = {
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
        // Optionale Lufttemperatur-Kachel
        {
          key: `${pool}:luft:temp`,
          label: pool === "filple" ? "Filple – Luft" : "Natur – Luft",
          type: "temp",
          unit: "°C",
          series: series(19.5, 4.5)
        },
        // UV-Index (zwei Quellen/Positionen)
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

    return data;
  }
};

/** =========================
 *  UTIL
 *  ========================= */
const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function groupByLocalDay(points) {
  const byDay = new Map();
  for (const p of points) {
    const d = new Date(p.ts);
    const key = toLocalISODate(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p.value);
  }
  return byDay;
}

/**
 * Tagesaggregation für letzte N Tage.
 * mode: "avg" | "max"
 */
function computeDaily(series, daysBack = 7, mode = "avg") {
  if (!Array.isArray(series)) return [];
  const now = new Date();
  const start = new Date(now.getTime() - (daysBack - 1) * DAY_MS);
  start.setHours(0,0,0,0);

  const filtered = series.filter(p => new Date(p.ts) >= start);
  const byDay = groupByLocalDay(filtered);
  const keys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

  const agg = (arr) => {
    if (!arr || !arr.length) return null;
    if (mode === "max") return Math.max(...arr);
    const s = arr.reduce((x, y) => x + y, 0);
    return s / arr.length;
  };

  return keys.map(k => ({ date: k, value: agg(byDay.get(k)) }));
}

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
 *  MODAL
 *  ========================= */
function openHistoryModal({ title, items, unit }) {
  historyTitle.textContent = title || "Historie";
  historyList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "Keine Messwerte im gewählten Zeitraum.";
    historyList.appendChild(li);
  } else {
    for (const entry of items) {
      const d = new Date(entry.date + "T00:00:00");
      const dateLabel = d.toLocaleDateString(LOCALE, {
        weekday: "short", day: "2-digit", month: "2-digit"
      });
      const li = document.createElement("li");
      li.textContent = `${dateLabel}: ${formatValue(entry.value, unit)}`;
      historyList.appendChild(li);
    }
  }

  historyModal.setAttribute("aria-hidden", "false");
  const dlg = historyModal.querySelector(".modal-dialog");
  dlg && dlg.focus();
}

function closeHistoryModal() {
  historyModal.setAttribute("aria-hidden", "true");
}

document.querySelectorAll('[data-close="hist"]').forEach(el => {
  el.addEventListener("click", closeHistoryModal);
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && historyModal.getAttribute("aria-hidden") === "false") {
    closeHistoryModal();
  }
});

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

  return card;
}

function latestValue(series) {
  if (!series || !series.length) return null;
  return series[series.length - 1].value;
}

function attachGridClick(gridEl) {
  if (!gridEl || gridEl.__clickBound) return;
  gridEl.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-key]");
    if (!card) return;
    const key   = card.getAttribute("data-key");
    const type  = card.getAttribute("data-type");
    const label = card.getAttribute("data-label") || key;
    const unit  = type === "uv" ? "" : "°C";

    const series = window.SENSOR_SERIES[key];
    const mode   = (type === "uv" && USE_UV_MAX_FOR_DAILY) ? "max" : "avg";
    const daily  = computeDaily(series, DAYS_HISTORY, mode);

    openHistoryModal({
      title: `${label} – letzte ${DAYS_HISTORY} Tage (${mode === "avg" ? "Durchschnitt" : "Maximum"})`,
      items: daily,
      unit
    });
  });
  gridEl.__clickBound = true;
}

function renderPool(poolId, gridEl, updatedEl, data) {
  if (!gridEl || !updatedEl) return;

  // Zeitreihen in globalen Speicher und Kacheln erstellen
  gridEl.innerHTML = "";
  data.tiles.forEach(t => {
    window.SENSOR_SERIES[t.key] = t.series;
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

  // Updated
  updatedEl.textContent = formatUpdated(data.updatedAt);

  // Click-Handler (einmalig)
  attachGridClick(gridEl);
}

/** =========================
 *  BOOTSTRAP
 *  ========================= */
async function init() {
  try {
    // Wenn du bereits Daten hast, kannst du sie in window.INIT_DATA_* legen.
    // Format wie DataProvider.fetch zurückgibt.
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
