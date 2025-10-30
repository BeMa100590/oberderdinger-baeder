/* app.js – nur Anzeige (Temperaturen & UV), kein History, design-schonend
   Verwendet NUR die vorhandenen Container:
   - #filple-grid, #natur-grid
   - #filple-updated, #natur-updated
*/

const LOCALE = "de-DE";

// ---- DOM ----
const elFilpleGrid = document.getElementById("filple-grid");
const elNaturGrid  = document.getElementById("natur-grid");
const elFilpleUpd  = document.getElementById("filple-updated");
const elNaturUpd   = document.getElementById("natur-updated");

// ---- Helfer ----
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

// ---- DataProvider ----
// Wenn du echte Daten hast, ersetze die Demo-Funktion unten durch deinen fetch().
// Erwartetes Rückgabeformat pro Pool:
// {
//   updatedAt: "2025-10-29T19:51:00Z",
//   tiles: [
//     { key:"filple:becken1:temp", label:"Wasser (Schwimmer)", type:"temp", unit:"°C", value:23.6 },
//     { key:"filple:becken2:temp", label:"Wasser (Nichtschw.)", type:"temp", unit:"°C", value:26.1 },
//     { key:"filple:luft:temp",    label:"Luft",               type:"temp", unit:"°C", value:19.8 },
//     { key:"filple:uv:außen",     label:"UV außen",           type:"uv",   unit:"",   value:3.2 },
//     { key:"filple:uv:innen",     label:"UV innen",           type:"uv",   unit:"",   value:1.1 },
//   ]
// }
const DataProvider = {
  async fetch(pool) {
    // ===== DEMO-DATEN (ersetzbar) =====
    const now = new Date();
    const rng = (min, max) => min + Math.random() * (max - min);

    const demo = (pool === "filple")
      ? {
          updatedAt: now.toISOString(),
          tiles: [
            { key:`${pool}:becken1:temp`, label:"Wasser (Schwimmer)",   type:"temp", unit:"°C", value:rng(22.5,24.5) },
            { key:`${pool}:becken2:temp`, label:"Wasser (Nichtschw.)",  type:"temp", unit:"°C", value:rng(25.0,27.0) },
            { key:`${pool}:luft:temp`,    label:"Luft",                 type:"temp", unit:"°C", value:rng(17.0,22.0) },
            { key:`${pool}:uv:außen`,     label:"UV außen",             type:"uv",   unit:"",   value:Math.max(0, Math.min(11, rng(1.5,5.5))) },
            { key:`${pool}:uv:innen`,     label:"UV innen",             type:"uv",   unit:"",   value:Math.max(0, Math.min(6, rng(0.5,2.0))) },
          ]
        }
      : {
          updatedAt: now.toISOString(),
          tiles: [
            { key:`${pool}:becken1:temp`, label:"Wasser (Schwimmer)",   type:"temp", unit:"°C", value:rng(21.0,23.0) },
            { key:`${pool}:becken2:temp`, label:"Wasser (Nichtschw.)",  type:"temp", unit:"°C", value:rng(22.0,24.0) },
            { key:`${pool}:luft:temp`,    label:"Luft",                 type:"temp", unit:"°C", value:rng(17.0,22.0) },
            { key:`${pool}:uv:außen`,     label:"UV außen",             type:"uv",   unit:"",   value:Math.max(0, Math.min(11, rng(1.0,5.0))) },
            { key:`${pool}:uv:innen`,     label:"UV innen",             type:"uv",   unit:"",   value:Math.max(0, Math.min(6, rng(0.3,1.6))) },
          ]
        };

    // Wenn du serverseitig bereits Daten reinreichst, nutze diese:
    // window.INIT_DATA_FILPLE / window.INIT_DATA_NATUR im selben Format.
    if (pool === "filple" && window.INIT_DATA_FILPLE) return window.INIT_DATA_FILPLE;
    if (pool === "natur"  && window.INIT_DATA_NATUR)  return window.INIT_DATA_NATUR;

    return demo;
  }
};

// ---- Rendering ----
// IMPORTANT: Wir erzeugen nur sehr schlichtes Markup, damit dein CSS greift.
// Jede Kachel ist ein <div class="thumb"> mit zwei Zeilen: Titel + Wert.
function renderTile(t) {
  const el = document.createElement("div");
  el.className = "thumb";
  el.setAttribute("data-key", t.key);
  el.setAttribute("data-type", t.type);

  const title = document.createElement("div");
  title.className = "thumb-title";
  title.textContent = t.label;

  const value = document.createElement("div");
  value.className = "thumb-value";
  value.textContent = formatValue(t.value, t.unit || (t.type === "temp" ? "°C" : ""));

  el.appendChild(title);
  el.appendChild(value);
  return el;
}

function renderPool(gridEl, updatedEl, data) {
  if (!gridEl || !updatedEl) return;
  gridEl.innerHTML = ""; // nur Grid-Inhalt, restliches Layout bleibt unberührt

  data.tiles.forEach(t => {
    const tile = renderTile(t);
    gridEl.appendChild(tile);
  });

  updatedEl.textContent = formatUpdated(data.updatedAt);
}

// ---- Boot ----
async function init() {
  try {
    const filple = await DataProvider.fetch("filple");
    const natur  = await DataProvider.fetch("natur");
    renderPool(elFilpleGrid, elFilpleUpd, filple);
    renderPool(elNaturGrid,  elNaturUpd,  natur);
  } catch (e) {
    console.error(e);
    if (elFilpleUpd) elFilpleUpd.textContent = "Fehler beim Laden der Daten.";
    if (elNaturUpd)  elNaturUpd.textContent  = "Fehler beim Laden der Daten.";
  }
}

document.addEventListener("DOMContentLoaded", init);
