// ════════════════════════════════════════════
// CONCIERGE — Prompt orchestration & routing
// Provider-agnostic: works with Claude, GPT, Gemini
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';
import { CONFIG } from './config.js';

/**
 * Build the system prompt with live city data context
 */
function buildSystemPrompt(cityData, zip) {
  const hour = new Date().getHours();
  const day  = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const wknd = [0, 6].includes(new Date().getDay());

  const shelterCtx = cityData.shelters.length > 0
    ? `${cityData.shelters.length} tornado shelters. Sample: ${cityData.shelters.slice(0, 2).map(s => JSON.stringify(s.attributes)).join('; ')}`
    : 'Tornado shelter data available from EMA.';

  const deptList = Object.entries(SERVICES)
    .map(([k, v]) => `- ${v.cat}: ${v.dept} | ${v.phone}`)
    .join('\n');

  return `You are the Montgomery Civic Concierge — an AI assistant for Montgomery, Alabama residents.

PERSONALITY: Professional, warm, concise, actionable. Like a knowledgeable city employee who genuinely cares.

CONTEXT:
- Day: ${day}
- Time: ${new Date().toLocaleTimeString('en-US')}
- Weekend: ${wknd}
- ZIP: ${zip || 'not provided'}

CITY DATA (live from Montgomery Open Data Portal):
- ${shelterCtx}
- ${cityData.sirens.length} weather sirens mapped
- 911 call records: ${cityData.calls911.length} loaded (monthly aggregated)
- 311 service requests: ${cityData.requests311.length} recent
- Paving projects: ${cityData.paving.length} tracked

DEPARTMENTS:
${deptList}

RESPOND IN EXACT JSON — no markdown, no backticks, no extra text:
{
  "category": "short category name",
  "categoryKey": "one of: sanitation, publicWorks, permits, businessLicense, police, fire, codeEnforcement, parks, traffic, ema, housing, council",
  "steps": ["step 1", "step 2", "step 3"],
  "contactDept": "department name",
  "contactPhone": "phone number",
  "contactExtra": "extra info or URL",
  "safetyLevel": "green or yellow or red",
  "safetyNote": "brief safety note for this area",
  "conciergeNote": "warm human closing (1-2 sentences). Mention if late evening or weekend. Always end positively.",
  "sources": ["source 1", "source 2"],
  "reportSubject": "subject line for formal report",
  "reportBody": "professional ready-to-send report text (3-4 sentences)"
}`;
}

/**
 * Ask the AI concierge
 * @param {string} query - User's question
 * @param {string} zip   - Optional ZIP code
 * @param {object} cityData - Live data from ArcGIS
 * @returns {object} Parsed JSON response
 */
export async function askConcierge(query, zip, cityData) {
  // If demo mode, use fallback routing
  if (CONFIG.MODE === 'demo') {
    console.log('[Concierge] Demo mode — using fallback routing');
    return fallbackRoute(query);
  }

  const systemPrompt = buildSystemPrompt(cityData, zip);
  const { endpoint, model, maxTokens } = CONFIG.llm;

  // Quick check: is the proxy endpoint available?
  // On GitHub Pages, /api/concierge is a static .js file → returns 405 on POST
  // On Vercel, it's a serverless function → returns 200
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query + (zip ? ` (ZIP: ${zip})` : '') }
        ],
      }),
    });

    // 405 = static hosting (GitHub Pages), not a real API
    if (res.status === 405 || res.status === 404) {
      console.log('[Concierge] Proxy not available (static hosting) — using fallback');
      return fallbackRoute(query);
    }

    if (!res.ok) {
      console.warn('[Concierge] API returned', res.status, '— using fallback');
      return fallbackRoute(query);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Concierge] AI call failed, using fallback:', err);
    return fallbackRoute(query);
  }
}

/**
 * Keyword-based fallback when AI is unavailable
 */
export function fallbackRoute(query) {
  const q = query.toLowerCase();
  let key = 'council';

  // Sanitation & Waste
  if (/trash|garbage|sanit|pickup|waste|dump|recycl|bulk/.test(q))                key = 'sanitation';
  // Roads & Infrastructure
  else if (/pothole|road|street|pav|sidewalk|curb/.test(q))                       key = 'publicWorks';
  // Business
  else if (/business|license|vendor|entrepreneur/.test(q))                         key = 'businessLicense';
  // Permits & Construction
  else if (/permit|construct|build|inspect|renovation/.test(q))                    key = 'permits';
  // Police & Safety
  else if (/crime|police|theft|break-in|safe|stolen|vandal/.test(q))               key = 'police';
  // Fire
  else if (/fire\s?station|smoke|fire\s?rescue/.test(q))                           key = 'fire';
  // Code Enforcement
  else if (/code|violation|property|abandon|blight|overgrown|vacant|vehicle/.test(q)) key = 'codeEnforcement';
  // Parks & Recreation
  else if (/park|trail|recreation|playground|green/.test(q))                        key = 'parks';
  // Traffic & Signals & Streetlights
  else if (/traffic|signal|streetlight|light\s?out|crosswalk|road\s?clos/.test(q))  key = 'traffic';
  // Emergency & Weather
  else if (/tornado|weather|emergency|shelter|siren|flood|storm/.test(q))           key = 'ema';
  // Planning & Zoning
  else if (/zone|zoning|plan|develop|land\s?use/.test(q))                           key = 'housing';
  // Food safety (→ codeEnforcement as closest dept)
  else if (/food|restaurant|health\s?score|inspection|hygiene/.test(q))             key = 'codeEnforcement';
  // Pharmacy / community (→ council as catch-all)
  else if (/pharmacy|clinic|doctor|hospital|medical/.test(q))                       key = 'council';

  const svc = SERVICES[key];

  return {
    category: svc.cat,
    categoryKey: key,
    steps: [
      `Contact ${svc.dept} for assistance.`,
      `Call ${svc.phone} during business hours (Mon–Fri, 8 AM – 5 PM).`,
      'You can also submit a 311 service request online for tracking.',
    ],
    contactDept: svc.dept,
    contactPhone: svc.phone,
    contactExtra: 'Visit montgomeryalabama.gov for more information',
    safetyLevel: 'green',
    safetyNote: 'No active alerts in your area.',
    conciergeNote: getConciergeNote(),
    sources: ['City of Montgomery Open Data', 'City Services Directory'],
    reportSubject: `Service Request: ${svc.cat}`,
    reportBody: `Dear ${svc.dept},\n\nI am writing to request assistance regarding: ${query}.\n\nPlease advise on next steps or direct me to the appropriate resource.\n\nThank you for your time.`,
  };
}

/**
 * Generate a context-aware concierge closing note
 */
export function getConciergeNote() {
  const hour = new Date().getHours();
  const day  = new Date().getDay();

  if (hour >= 20)
    return "It's getting late — consider using online reporting now and following up during office hours tomorrow.";
  if (hour < 7)
    return "Early hours — most offices open at 8 AM. You can submit online now and follow up later.";
  if (day === 0 || day === 6)
    return "Heads up: office hours may be limited on weekends. Online reporting is usually your best bet.";
  return "Hope this helps — have a good day!";
}
