# Oberderdinger Bäder – Temperaturen

Fertige, statische Website, die die **Wasser- und Außentemperaturen** für
- **Filplebad Oberderdingen**
- **Naturerlebnisbad Flehingen**

anzeigt. Datenquelle: ThingSpeak (jeweils letzter Messwert).

## Deployment (GitHub Pages)

1. Neues Repository anlegen (z. B. `oberderdingen-baeder`).
2. Alle Dateien aus diesem Ordner pushen.
3. In den Repository-Einstellungen **Pages** aktivieren (Branch `main`, Ordner `/root`).  
4. Nach kurzer Zeit ist die Seite live.

## Konfiguration

Die ThingSpeak-Channel-IDs & Read-Keys liegen zentral in `script.js`:
```js
const CONFIG = {
  wasser: { channelId: 3089969, readKey: "G93FDQPXIJ75KSOR" },
  aussen: { channelId: 3094234, readKey: "OZU6XCJ29SCQTLQT" }
};
```
Falls sich etwas ändert, hier anpassen.

## Assets

- `assets/filplebad.jpg`
- `assets/Naturerlebnisbad.jpg`

## Datenschutz/Impressum

Die Beispielseite `impressum.html` ist ein Platzhalter.
