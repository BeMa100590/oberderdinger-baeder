/* app.js – Minimal & design-sicher
   - Keine Historie
   - Greift NICHT in deine Kachel-HTML ein
   - Setzt nur die "Zuletzt aktualisiert" Texte pro Pool
*/

const LOCALE = "de-DE";

const elFilpleUpd = document.getElementById("filple-updated");
const elNaturUpd  = document.getElementById("natur-updated");

// ---- HILFSFUNKTIONEN ----
function formatUpdated(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString(LOCALE, { day:"2-digit", month:"2-digit", year:"numeric" });
  const time = d.toLocaleTimeString(LOCALE, { hour:"2-digit", minute:"2-digit" });
  return `Zuletzt aktualisiert: ${date}, ${time} Uhr`;
}

// ---- DATENBESCHAFFUNG (DEMO ODER ECHT) ----
// ⚠️ Ersetze diesen Demo-Provider durch deinen echten Fetch,
// aber gib in jedem Fall ein Objekt mit { updatedAt } zurück.
const DataProvider = {
  async fetch(pool) {
    // DEMO: nur Zeitstempel liefern, NICHTS an Grids verändern
    return { updatedAt: new Date().toISOString() };
  }
};

// ---- RENDER: nur Updated-Text setzen ----
function renderUpdated(el, updatedAt) {
  if (el) el.textContent = formatUpdated(updatedAt);
}

// ---- BOOTSTRAP ----
async function init() {
  try {
    const filple = await DataProvider.fetch("filple");
    const natur  = await DataProvider.fetch("natur");
    renderUpdated(elFilpleUpd, filple.updatedAt);
    renderUpdated(elNaturUpd,  natur.updatedAt);
  } catch (e) {
    console.error(e);
    if (elFilpleUpd) elFilpleUpd.textContent = "Fehler beim Laden der Daten.";
    if (elNaturUpd)  elNaturUpd.textContent  = "Fehler beim Laden der Daten.";
  }
}

document.addEventListener("DOMContentLoaded", init);
