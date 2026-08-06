# YouTube Studio Insights

Eine moderne Fullstack-Webanwendung zur Anzeige von YouTube-Kanalanalysen mit Dark-Mode-Design, OAuth 2.0-Login, Analytics-Dashboard und KI-Assistent.

## Funktionen
- Google/YouTube OAuth 2.0 Login
- Kanal-Header mit Profilbild, Name und Abonnentenanzahl
- KPI-Karten für Aufrufe, Wiedergabezeit und Abonnenten-Zuwachs
- Interaktives Verlaufsdiagramm mit Chart.js
- Monetarisierungs-Fortschritt für wichtige Meilensteine
- Top-Videos-Liste
- KI-Chat-Assistent für Fragen zu den Kanal-Daten

## Tech Stack
- Frontend: HTML, Tailwind CSS, JavaScript
- Backend: Node.js, Express
- APIs: YouTube Data API v3, YouTube Analytics API, OpenAI-compatible AI API

## Installation
```bash
npm install
```

## Konfiguration
Erstelle eine `.env`-Datei basierend auf `.env.example` und fülle die Werte aus:

```env
PORT=3000
CLIENT_ID=dein_google_client_id
CLIENT_SECRET=dein_google_client_secret
REDIRECT_URI=http://localhost:3000/oauth/google/callback
API_KEY=dein_ai_api_schluessel
AI_PROVIDER=openai
```

## Starten
```bash
node server.js
```

Öffne danach:
```text
http://localhost:3000
```

## Hinweise
- Für die echte YouTube-Authentifizierung müssen die Google OAuth-Anmeldedaten korrekt hinterlegt sein.
- Der KI-Assistent arbeitet im Demo-Modus, solange kein echter API-Schlüssel gesetzt ist.
