// app.js — Minimal: Temperaturen & UV sicher anzeigen (keine Historie)

const LOCALE = "de-DE";

// ---- DOM ----
const filpleGrid = document.getElementById("filple-grid");
const naturGrid  = document.getElementById("natur-grid");
const filpleUpd  = document.getElementById("filple-updated");
const naturUpd   = document.getElementById("natur-updated");

// ---- Helpers ----
function fmtVal(v, unit) {
  if (v == null || Number.isNaN(v)) return "–";
  const digits = unit === "°C" ? 1 : 1;
  return `${v.toFixed(digits)}${unit ? " " + unit : ""}`;
}
function fmtUpdated(ts) {
  const d = new Date(ts);
  return `Zuletzt aktualisiert: ${d.toLocaleDateString(LOCALE, {day:"2-digit",month:"2-digit",year:"numeric"})}, ${d.toLocaleTimeString(LOCALE,{hour:"2-digit",minute:"2-digit"})} Uhr`;
}

// ---- Datenquelle (ersetze durch echte Fetches, wenn vorhanden) ----
async function fetchPoolData(pool) {
  // Wenn du serverseitig Daten injizierst, nutze sie:
  if (pool === "filple" && window.INIT_DATA_FILPLE) return window.INIT_DATA_FILPLE;
  if (pool === "natur"  && window.INIT_DATA_NATUR)  return window.INIT_DATA_NATUR;

  // DEMO: fixe Werte, damit Temperaturen garantiert erscheinen
  const nowISO = new Date().toISOString();
  if (pool === "filple") {
    return {
      updatedAt: nowISO,
      tiles: [
        { key:`${pool}:wasser:schwimmer`,  label:"Wasser (Schwimmer)",    type:"temp", unit:"°C", value:23.6 },
        { key:`${pool}:wasser:nichtschw`,  label:"Wasser (Nichtschw.)",   type:"temp", unit:"°C", value:26.2 },
        { key:`${pool}:luft:aktuell`,      label:"Luft",                  type:"temp", unit:"°C", value:19.9 },
        { key:`${pool}:uv:außen`,          label:"UV außen",              type:"uv",   unit:"",   value:3.2  },
        { key:`${pool}:uv:innen`,          label:"UV innen",              type:"uv",   unit:"",   value:1.1  },
      ]
    };
  } else {
    return {
      updatedAt: nowISO,
      tiles: [
        { key:`${pool}:wasser:schwimmer`,  label:"Wasser (Schwimmer)",    type:"temp", unit:"°C", value:22.4 },
        { key:`${pool}:wasser:nichtschw`,  label:"Wasser (Nichtschw.)",   type:"temp", unit:"°C", value:23.5 },
        { key:`${pool}:luft:aktuell`,      label:"Luft",                  type:"temp", unit:"°C", value:18.7 },
        { key:`${pool}:uv:außen`,          label:"UV außen",              type:"uv",   unit:"",   value:2.7  },
        { key:`${pool}:uv:innen`,          label:"UV innen",              type:"uv",   unit:"",   value:0.9  },
      ]
    };
  }
}

// ---- Rendering ----
// Wir erzeugen extrem simples Markup, das typischerweise mit bestehenden Styles klappt:
// <div class="thumb" data-key ...>
//   <div class="thumb-title">Label</div>
//   <div class="thumb-value">23.6 °C</div>
// </div>
function renderTile(t) {
  const wrap = document.createElement("div");
  wrap.className = "thumb";
  wrap.setAttribute("data-key", t.key);
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

  // Wichtig: zuerst leeren, dann nur unsere Kacheln einsetzen
  gridEl.innerHTML = "";

  // Reihenfolge: Wasser (Schwimmer), Wasser (Nichtschw.), Luft, UV außen, UV innen
  const order = ["wasser:schwimmer","wasser:nichtschw","luft:aktuell","uv:außen","uv:innen"];

  const tilesSorted = data.tiles.slice().sort((a,b) => {
    const ai = order.findIndex(k => a.key.includes(k));
    const bi = order.findIndex(k => b.key.includes(k));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  tilesSorted.forEach(t => gridEl.appendChild(renderTile(t)));

  updatedEl.textContent = fmtUpdated(data.updatedAt);
}

// ---- Init ----
async function init() {
  try {
    const filple = await fetchPoolData("filple");
    const natur  = await fetchPoolData("natur");

    // Log, falls irgendwas fehlt
    console.log("[filple]", filple);
    console.log("[natur ]", natur);

    renderPool(filpleGrid, filpleUpd, filple);
    renderPool(naturGrid,  naturUpd,  natur);
  } catch (err) {
    console.error("Fehler:", err);
    if (filpleUpd) filpleUpd.textContent = "Fehler beim Laden.";
    if (naturUpd)  naturUpd.textContent  = "Fehler beim Laden.";
  }
}

document.addEventListener("DOMContentLoaded", init);
