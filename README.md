# Kopplanner

Planner-ähnliche Oberfläche (Raster, Board, Kalender, Diagramme, Gruppierungen) für die Aufträge eines koppla-Projekts.
Läuft komplett im Browser, ohne eigenes Backend.

Layout-Entwurf: [Figma – Kopplanner Layout](https://www.figma.com/design/0stVKtwxohZgtHi8JLh8OU?node-id=1-2)

## Starten

```bash
npm install
```

```bash
npm run dev
```

Dann <http://localhost:5173> öffnen und unter **Verbindung** eintragen:

1. **API-Key** (Lesen): koppla → Einstellungen → Sicherheit & Zugang → API Key. Wird nur im `localStorage` dieses Browsers gespeichert.
2. **koppla-Login** (Bearbeiten, optional): E-Mail und Passwort. Das Passwort wird nicht gespeichert, nur das Sitzungs-Token im `sessionStorage` (weg, sobald der Tab geschlossen wird).

Projekt: fest auf **REKO AK BIM** eingestellt. Ein anderes Projekt lässt sich über `VITE_KOPPLA_PROJECT_ID` in `.env` setzen (siehe `.env.example`).

## Funktionen

| Ansicht | Inhalt |
|---|---|
| Raster | Tabelle, sortierbar, Gruppen auf-/zuklappbar |
| Board | Spalten je Gruppe; bei Gruppierung nach „Fortschritt“ oder „koppla-Status“ per Drag & Drop Status melden |
| Kalender | Monat/Woche; Aufgaben am Fälligkeitstag; Ziehen auf anderen Tag verschiebt den Termin |
| Diagramme | Donut „Verbleibende Aufgaben“, gestapelte Säulen nach Bucket, Fälligkeit, Zugewiesen zu |

Gruppieren nach: Bucket (= WBS-Abschnitt), Zugewiesen zu (= koppla-Gewerk), Gruppe, Fortschritt, koppla-Status, Startdatum, Fälligkeitsdatum.

Fortschritts-Kategorien wie im Planner: *Nicht begonnen*, *In Bearbeitung*, *Überfällig* (nicht erledigt und Fälligkeit vor heute), *Abgeschlossen* (koppla-Status `DONE`).

Bearbeiten (nur mit koppla-Login, kein Neuanlegen):

- **Status melden**: Im Plan / Verzug / Problem / Als fertig gemeldet / Erledigt, Fortschritt %, Grund, Kommentar
- **Termin ändern**: Start und Fälligkeit (immer nur ein Auftrag pro Änderung)
- Vor jedem Speichern zeigt ein Bestätigungsschritt „vorher → nachher“.

## Technik

- **Lesen:** koppla Public REST API `https://api-v2.koppla.de` mit `Authorization: Bearer <API-Key>` ([API-Doku](https://my.koppla.de/api-docs)). CORS ist für alle Herkünfte offen.
- **Bearbeiten:** Die öffentliche API ist nur lesend. Gespeichert wird deshalb über die **interne, nicht dokumentierte** Echtzeit-Schnittstelle der koppla-Web-App (Socket.io, `wss://rtc.koppla.de`):
  - Login: `POST https://api-v2.koppla.de/auth/login` → `accessToken`
  - `subscribe_to_project` → `project_change` mit Operation `CreateOrderStatusReports` bzw. `UpdateOrders`
  - Details: `src/api/rtc.ts`

### Risiken der Schreibfunktion

- Die Schnittstelle ist aus der koppla-Web-App nachgebaut, nicht offiziell. Sie kann sich bei jedem koppla-Update ändern.
- Noch nicht gegen koppla getestet (Stand der ersten Version). Erster Test bitte an einer unkritischen Aufgabe.
- Unbekannt ist, ob koppla die Verbindung von `localhost` bzw. einer fremden Domain annimmt.
- Terminänderungen können in koppla abhängige Aufträge mitverschieben.

Datumslogik: koppla speichert Zeitpunkte in UTC und das Ende exklusiv (`finishAt` = Folgetag 00:00). Die App zeigt den letzten Tag als „Fällig am“ und rechnet beim Speichern zurück.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ansehen |
| `npm run build:single` | Eine einzelne `dist-single/index.html` (JS/CSS eingebettet), per Doppelklick ohne Webserver zu öffnen |
