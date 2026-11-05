# 🃏 SkyJo Punkteblock

Ein schneller, moderner digitaler Punkteblock für **SkyJo** – optimiert für das Smartphone (insbesondere **Safari auf dem iPhone**) und direkt bereit für **GitHub Pages**.

## ✨ Features

- **100-Punkte-Verliergrenze vordefiniert:** Sobald mindestens eine Person `100` (oder ein individuell angepasstes Limit) erreicht, endet die Partie automatisch und kürt die Person mit den **wenigsten Gesamtpunkten** zum Sieger.
- **Spieleranzahl mit 4-Spieler-Vorauswahl:** Abfrage von `2` bis `8` Spielern – standardmäßig sind direkt **4 Plätze** vorausgewählt.
- **Automatischer Spielerspeicher & Verwaltung:** Einmal eingetragene Spielernamen werden lokal im Browser gespeichert und stehen beim nächsten Spielabend sofort als **1-Klick-Schnellauswahl** bereit. Seltene Gäste lassen sich jederzeit einzeln wieder aus der Liste löschen (inkl. *Rückgängig*-Funktion).
- **Safari Display-Wachhalter (Wake Lock):** Hält das Smartphone-Display während des Spielens automatisch eingeschaltet, damit das Handy am Spieltisch nicht ständig sperrt.
- **Schnelle Minuspunkte-Eingabe (`±`):** Auf dem iPhone-Ziffernblock fehlt oft die Minus-Taste – über den großen **`±`**-Button neben jedem Feld lassen sich `-1`, `-2` oder negative Rundensummen mit einem Fingertipp eingeben.
- **Offizielle SkyJo-Verdopplungsregel (optional):** Wer die Runde beendet und nicht *allein* die niedrigste Punktzahl der Runde hat (bei mehr als `0` Punkten), bekommt die Rundenpunkte automatisch verdoppelt (`×2`).
- **Rundenverlauf & Korrektur:** Farbcodierte SkyJo-Kartenwerte, laufende Zwischensummen und einfaches Antippen jeder vergangenen Runde zum Bearbeiten oder Löschen bei Tippfehlern.
- **Hell- & Dunkelmodus:** Passt sich automatisch dem System an oder lässt sich manuell umschalten.

---

## 🚀 Auf GitHub Pages veröffentlichen (in 2 Minuten)

Da die Webseite komplett ohne Build-Schritt auskommt, kannst du alle Dateien direkt hochladen:

1. Erstelle auf [github.com/new](https://github.com/new) ein neues Repository (z. B. `skyjo-punkteblock`, auf **Public** stellen).
2. Lade alle Dateien aus diesem Ordner (`index.html`, `styles.css`, `app.js`, `icon.svg`, `manifest.webmanifest`, `README.md`) in das Repository hoch.
3. Öffne im Repository oben **Settings** → links **Pages**.
4. Wähle unter **Build and deployment → Source** die Option **Deploy from a branch** und darunter den Branch **`main`** (`/ (root)`) → klicke auf **Save**.
5. Nach ca. 30–60 Sekunden ist deine eigene SkyJo-App unter `https://<dein-nutzername>.github.io/<repo-name>/` erreichbar!

---

## 📱 Tipp für Safari auf dem iPhone

1. Öffne deine veröffentlichte GitHub-Pages-URL in **Safari**.
2. Tippe unten auf das **Teilen-Symbol** (`↑`) → **Zum Home-Bildschirm**.
3. Dadurch startet der SkyJo-Punkteblock im Vollbild wie eine native App – inklusive gespeichertem Spielstand, gemerkten Freunden und aktivem Display-Wachhalter.

> **Hinweis zum iPhone-Stromsparmodus:** Wenn auf dem iPhone der *Stromsparmodus* (gelbes Batteriesymbol) aktiv ist, erzwingt iOS systemseitig das Abdunkeln des Bildschirms. Für dauerhaft aktives Display sollte der Stromsparmodus während der Spielrunde ausgeschaltet sein.
