# Montgomery Civic Concierge

**AI-powered civic assistant that helps Montgomery residents instantly find the right city service, understand what to do next, and generate ready-to-send reports — using real city data and public web intelligence.**

> Built solo for the [World Wide Vibes Hackathon](https://academy.genai.works/hackathon) · GenAI.Works Academy · March 2026

**Challenge area:** Civic Access & Community Communication  
**Live demo:** [nilsdanieljohansson-ops.github.io/montgomery-civic-concierge](https://nilsdanieljohansson-ops.github.io/montgomery-civic-concierge/)  
**Slide deck:** [montgomery_civic_concierge_slide_deck.pptx](montgomery_civic_concierge_slide_deck.pptx)  
**Project summary:** [montgomery_civic_concierge_summary.pdf](montgomery_civic_concierge_summary.pdf)

---

## The Idea in 10 Seconds

City services are hard to navigate. Residents don't know which department handles their issue, what steps to take, or how to write a proper report.

**Montgomery Civic Concierge** lets residents simply ask:

```
"How do I report a pothole?"
```

The AI instantly:
- Routes the request to the correct department
- Explains what to do next in clear steps
- Uses live city data for context
- Generates a ready-to-send report

Think of it as **a civic concierge powered by AI and real Montgomery data.**

---

## How It Works

```
Resident asks a question
        ↓
  Prompt Orchestrator
  (builds context from live city data + web signals)
        ↓
  AI Concierge Router
  (Claude API via serverless proxy)
        ↓
  Structured JSON Response
  (department, steps, contact, safety status, report)
        ↓
  UI renders actionable result
  (step cards, report template, safety badge, concierge note)
```

The response is always structured and deterministic — not a wall of text, but organized guidance a resident can act on immediately.

---

## Example Questions

Residents can ask natural questions like:

- *How do I report a pothole?*
- *Where is the nearest tornado shelter?*
- *My trash wasn't picked up*
- *I need a business license*
- *Streetlight is out near my house*
- *There's an abandoned car on my block*
- *I want to report illegal dumping*
- *Road construction is blocking my route*

The system returns the correct department, clear next steps, relevant data, and a formatted report template — every time.

---

## Key Features

### AI Civic Routing
Understands natural language and routes to the correct city department out of 12 service categories. Falls back to keyword-based routing when AI is unavailable.

### City Data Context
Pulls live data from Montgomery's Open Data Portal (ArcGIS) — tornado shelters, 911 call trends, 311 service requests, paving projects, and more — and injects it into AI responses for local relevance.

### Shelter Enrichment
When a resident asks about tornado shelters, the system scores and ranks all shelters from the city dataset, considering address completeness, accessibility, capacity, and ZIP proximity.

### Report Generator
Creates a structured, professional report residents can copy or open directly in email — ready to submit to the city.

### Safety Status Badge
Integrated safety awareness across the UI. Dynamically adjusts based on query context (green/yellow/red) with expandable details.

### City Health Score
A live composite score based on 911 volume, 311 requests, infrastructure projects, and emergency resources — giving residents a quick sense of city service health.

### City Pulse Sidebar
Live cards showing weather/EMA status, public safety, infrastructure updates, and 311 activity — all from real ArcGIS data.

### Web Intelligence (Bright Data)
Public web signals scraped from official Montgomery city pages (news, alerts, road closures, events) via Bright Data, enriching the concierge with information not available in structured datasets.

### Concierge Note
Context-aware closing message that adapts to time of day and day of week — "It's getting late, online reporting may be quickest tonight."

---

## Data Sources

| Source | Type | What it provides |
|--------|------|-----------------|
| [Montgomery Open Data Portal](https://opendata.montgomeryal.gov/) | ArcGIS REST APIs | 19 datasets — tornado shelters, weather sirens, 911 calls, 311 requests, paving projects, fire/police stations, business licenses, code violations, food scores, parks, pharmacies, and more |
| [Bright Data](https://brightdata.com) Crawl API | Web scraping | Live city news, emergency alerts, road closures, community events from official Montgomery web pages |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML, CSS, Vanilla JavaScript (ES modules) |
| **AI** | Claude API (Anthropic) via serverless proxy — provider-agnostic architecture |
| **City data** | ArcGIS REST API queries to Montgomery Open Data Portal |
| **Web data** | Bright Data Crawl API for real-time web intelligence |
| **Proxy** | Vercel Serverless Functions (API keys stay server-side) |
| **Hosting** | GitHub Pages (static) + Vercel (API proxy) |

---

## Project Structure

```
montgomery-civic-concierge/
├── index.html                 ← Main page (accessible, semantic HTML)
├── favicon.png
├── css/
│   └── styles.css             ← Complete design system
├── js/
│   ├── main.js                ← App init, shelter enrichment, state management
│   ├── config.js              ← API config, feature flags, mode switching
│   ├── sources.js             ← 19 ArcGIS endpoints + 12 city departments
│   ├── arcgis.js              ← ArcGIS REST query helpers
│   ├── concierge.js           ← Prompt orchestration, fallback routing
│   ├── brightdata.js          ← Bright Data crawl integration + demo fallback
│   ├── ui.js                  ← DOM rendering (cards, badges, pulse, reports)
│   └── tester.js              ← Endpoint connectivity checker
├── api/
│   └── claude.js              ← Vercel serverless proxy (handles API auth)
├── data/
│   ├── pulse-demo.json        ← Fallback: city pulse data
│   ├── services-demo.json     ← Fallback: service responses
│   ├── badge-demo.json        ← Fallback: safety badge states
│   └── brightdata-demo.json   ← Fallback: web intelligence
└── vercel.json                ← Vercel deployment config
```

### Smart Fallback System

The app runs in three modes (`config.js`):

| Mode | Behavior |
|------|----------|
| `auto` | Try live APIs first → fall back to demo data if they fail |
| `live` | Only live APIs — errors shown if they fail |
| `demo` | Only local JSON files — zero API calls |

This means the app always works, even during demo, even offline, even if APIs are down.

---

## Example Response

The AI returns structured data like this:

```json
{
  "category": "Roads & Infrastructure",
  "categoryKey": "publicWorks",
  "steps": [
    "Note the exact location and size of the pothole",
    "Call Public Works at (334) 625-2180 or submit a 311 request online",
    "Mention if it poses a safety hazard for priority handling"
  ],
  "contactDept": "Public Works Department",
  "contactPhone": "(334) 625-2180",
  "safetyLevel": "green",
  "safetyNote": "No active alerts in your area.",
  "reportSubject": "Pothole Report — Road Maintenance Request",
  "reportBody": "Dear Public Works Department,\n\nI would like to report a pothole..."
}
```

This structured format ensures the UI can render clean, actionable results every time.

---

## Why This Matters

City information is fragmented across departments, websites, and phone trees. Residents don't know where to report issues, which department is responsible, or what steps to take.

Montgomery Civic Concierge reduces that friction to a single question.

It's designed for **real residents** — not analysts, not city staff — people who just need to know what to do and who to call.

---

## Judging Criteria Alignment

| Criteria | Score | How we address it |
|----------|-------|------------------|
| **Relevance** | /10 | Directly addresses "Improve city communication and public access" using Montgomery Open Data |
| **Quality & Design** | /10 | Polished design system, accessible HTML, clean modular code, robust error handling |
| **Originality** | /5 | AI routing + shelter enrichment + report generation + safety awareness in one interface |
| **Social Impact** | /5 | Helps all residents — especially those unfamiliar with city processes |
| **Commercialization** | /5 | Adaptable to any city with open data; SaaS potential |
| **Bright Data Bonus** | +3 | Integrated Crawl API for live web intelligence |

---

## Future Vision

This platform could evolve into a full AI civic copilot:

- Voice interface for accessibility
- Proactive city alerts and notifications
- Real-time infrastructure monitoring
- Multi-language support
- Multi-city deployment

---

## Author

**Daniel Johansson** · Solo builder · Karlskrona, Sweden  
"One Solo Meatball"

---

## License

MIT License

---

*This is an informational AI tool — not an official City of Montgomery service. Not an emergency system. In an emergency, call 911.*

⭐ **If you like this project, give it a star on GitHub.**
