/* app.js — Anzeige für Temperaturen & UV (ohne Historie)
   Nutzt vorhandene Container:
   - #filple-grid, #natur-grid
   - #filple-updated, #natur-updated
*/

const LOCALE = "de-DE";

// DOM-Referenzen
const filpleGrid = document.getElementById("filple-grid");
const naturGrid  = document.getElementById("natur-grid");
const filpleUpd  = document.getElementById("filple-updated");
const naturUpd   = document.getElementById("natur-updated");

// Format-Helfer
function fmtVal(v, unit) {
  if (v == null || Number.isNaN(v)) return "–";
  const digits = unit === "°C" ? 1 : 1;
  return `${v.toFixed(digits)}${unit ? " " + unit : ""}`;
}
function fmtUpdated(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString(LOCALE, { day:"2-digit", month:"2-digit", year:"numeric" });
  const time = d.toLocaleTimeString(LOCALE, { hour:"2-digit", minute:"2-digit" });
  return `Zuletzt aktualisiert: ${date}, ${time} Uhr`;
}

// ---- Datenquelle ----
// Wenn du echte API-Daten hast, ersetze den DEMO-Teil unten durch fetch('/api/...').
// Erwartetes Format (pro Pool):
// { updatedAt: "ISO-TS",
//   tiles: [ { label, type:"temp"|"uv", unit:"°C"|"" , value:Number }, ... ] }
async function fetchPoolData(pool) {
  // Falls du schon serverseitig Daten einbindest:
  if (pool === "filple" && window.INIT_DATA_FILPLE) return window.INIT_DATA_FILPLE;
  if (pool === "natur"  && window.INIT_DATA_NATUR)  return window.INIT_DATA_NATUR;

  // ---- DEMO: feste Beispielwerte, damit sofort etwas sichtbar ist ----
  const nowISO = new Date().toISOString();
  if (pool === "filple") {
    return {
      updatedAt: nowISO,
      tiles: [
        { label:"Wasser (Schwimmer)",   type:"temp", unit:"°C", value:23.6 },
        { label:"Wasser (Nichtschw.)",  type:"temp", unit:"°C", value:26.2 },
        { label:"Luft",                 type:"temp", unit:"°C", value:19.9 },
        { label:"UV außen",             type:"uv",   unit:"",   value:3.2  },
        { label:"UV innen",             type:"uv",   unit:"",   value:1.1  },
      ]
    };
  } else {
    return {
      updatedAt: nowISO,
      tiles: [
        { label:"Wasser (Schwimmer)",   type:"temp", unit:"°C", value:22.4 },
        { label:"Wasser (Nichtschw.)",  type:"temp", unit:"°C", value:23.5 },
        { label:"Luft",                 type:"temp", unit:"°C", value:18.7 },
        { label:"UV außen",             type:"uv",   unit:"",   value:2.7  },
        { label:"UV innen",             type:"uv",   unit:"",   value:0.9  },
      ]
    };
  }
}

// Kachel (bewusst schlichtes Markup, damit dein CSS greift)
function renderTile(t) {
  // Struktur:
  // <div class="thumb" data-type="temp|uv">
  //   <div class="thumb-title">Label</div>
  //   <div class="thumb-value">23.6 °C</div>
  // </div>
  const wrap = document.createElement("div");
  wrap.className = "thumb";
  wrap.setAttribute("data-type", t.type);

  const title = document.createElement("div");
  title.className = "thumb-title";
  title.textContent = t.label;

  const value = document.createElement("div");
  value.className = "thumb-value";
  value.textContent = fmtVal(t.value, t.unit || (t.type === "temp" ? "°C" : ""));

  wrap.appendChild(title);
  wrap.appendChild(value);
  return wrap;
}

function renderPool(gridEl, updatedEl, data) {
  if (!gridEl || !updatedEl) return;

  // Reihenfolge: Wasser Schwimmer, Wasser Nichtschw., Luft, UV außen, UV innen
  const order = ["Wasser (Schwimmer)", "Wasser (Nichtschw.)", "Luft", "UV außen", "UV innen"];
  const tilesSorted = data.tiles.slice().sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label)
  );

  gridEl.innerHTML = "";
  tilesSorted.forEach(t => gridEl.appendChild(renderTile(t)));
  updatedEl.textContent = fmtUpdated(data.updatedAt);
}

// Init
async function init() {
  try {
    const filple = await fetchPoolData("filple");
    const natur  = await fetchPoolData("natur");

    renderPool(filpleGrid, filpleUpd, filple);
    renderPool(naturGrid,  naturUpd,  natur);
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    if (filpleUpd) filpleUpd.textContent = "Fehler beim Laden.";
    if (naturUpd)  naturUpd.textContent  = "Fehler beim Laden.";
  }
}

document.addEventListener("DOMContentLoaded", init);
