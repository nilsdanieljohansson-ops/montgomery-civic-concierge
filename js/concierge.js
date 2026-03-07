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
  // If demo mode, use demo data files
  if (CONFIG.USE_DEMO_DATA) {
    console.log('[Concierge] Demo mode — using fallback routing');
    return fallbackRoute(query);
  }

  const systemPrompt = buildSystemPrompt(cityData, zip);
  const { endpoint, model, maxTokens, apiKey } = CONFIG.llm;

  // If no API key configured, fall back gracefully
  if (!apiKey) {
    console.warn('[Concierge] No API key configured, using fallback');
    return fallbackRoute(query);
  }

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

  if (/trash|garbage|sanit|pickup|waste/.test(q))          key = 'sanitation';
  else if (/pothole|road|street|pav|sidewalk/.test(q))     key = 'publicWorks';
  else if (/business|license/.test(q))                      key = 'businessLicense';
  else if (/permit|construct|build|inspect/.test(q))        key = 'permits';
  else if (/crime|police|theft|break-in|safe/.test(q))      key = 'police';
  else if (/fire|smoke/.test(q))                             key = 'fire';
  else if (/code|violation|property|abandon|blight/.test(q)) key = 'codeEnforcement';
  else if (/park|trail|recreation/.test(q))                  key = 'parks';
  else if (/traffic|signal|light|streetlight/.test(q))       key = 'traffic';
  else if (/tornado|weather|emergency|shelter|siren/.test(q)) key = 'ema';
  else if (/zone|zoning|plan|develop/.test(q))               key = 'housing';

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