// ════════════════════════════════════════════
// CONCIERGE — Prompt orchestration & routing
// Provider-agnostic: works with Claude, GPT, Gemini
// Improved for robustness, cleaner prompting, safer JSON parsing
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';
import { CONFIG } from './config.js';

/**
 * Small utility: current time context
 */
function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const dayIndex = now.getDay();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const isWeekend = [0, 6].includes(dayIndex);

  return {
    now,
    hour,
    dayIndex,
    dayName,
    isWeekend,
    timeString: now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  };
}

/**
 * Summarize live city data into concise model-safe context
 */
function buildCitySummary(cityData = {}, zip = '') {
  const shelters = Array.isArray(cityData.shelters) ? cityData.shelters : [];
  const sirens = Array.isArray(cityData.sirens) ? cityData.sirens : [];
  const calls911 = Array.isArray(cityData.calls911) ? cityData.calls911 : [];
  const requests311 = Array.isArray(cityData.requests311) ? cityData.requests311 : [];
  const paving = Array.isArray(cityData.paving) ? cityData.paving : [];

  const shelterPreview = shelters.slice(0, 2).map(item => item?.attributes || item).filter(Boolean);
  const pavingPreview = paving.slice(0, 2).map(item => item?.attributes || item).filter(Boolean);

  return {
    zip: zip || null,
    liveData: {
      tornadoSheltersCount: shelters.length,
      weatherSirensCount: sirens.length,
      calls911Count: calls911.length,
      requests311Count: requests311.length,
      pavingProjectsCount: paving.length
    },
    examples: {
      shelterSample: shelterPreview,
      pavingSample: pavingPreview
    }
  };
}

/**
 * Convert SERVICES into concise department guide for prompt
 */
function buildDepartmentGuide() {
  return Object.entries(SERVICES).map(([key, value]) => ({
    key,
    category: value.cat,
    department: value.dept,
    phone: value.phone
  }));
}

/**
 * Determine a reasonable safety baseline from city data + query
 */
function inferSafetyBaseline(query, cityData = {}) {
  const q = (query || '').toLowerCase();
  const shelters = Array.isArray(cityData.shelters) ? cityData.shelters.length : 0;
  const sirens = Array.isArray(cityData.sirens) ? cityData.sirens.length : 0;
  const paving = Array.isArray(cityData.paving) ? cityData.paving.length : 0;

  if (/tornado|storm|weather|shelter|flood|emergency|siren/.test(q)) {
    if (shelters > 0 || sirens > 0) {
      return {
        level: 'yellow',
        note: `Weather-related resources are available nearby. ${shelters} shelter(s) and ${sirens} siren location(s) are currently mapped.`
      };
    }
    return {
      level: 'yellow',
      note: 'Weather-related concern detected. Emergency resources should be verified before traveling.'
    };
  }

  if (/road|pothole|street|traffic|closure|construction|detour|sidewalk/.test(q)) {
    if (paving > 0) {
      return {
        level: 'yellow',
        note: `${paving} infrastructure or paving record(s) are currently loaded and may affect travel routes.`
      };
    }
  }

  if (/fire|smoke|crime|break-in|theft|stolen|unsafe|police/.test(q)) {
    return {
      level: 'yellow',
      note: 'Safety-related concern detected. If this is urgent or active, contact emergency services immediately.'
    };
  }

  return {
    level: 'green',
    note: 'No direct safety risk inferred from the request.'
  };
}

/**
 * Build system prompt
 */
function buildSystemPrompt(query, cityData, zip) {
  const time = getTimeContext();
  const citySummary = buildCitySummary(cityData, zip);
  const deptGuide = buildDepartmentGuide();
  const baseline = inferSafetyBaseline(query, cityData);

  return `
You are Montgomery Civic Concierge, an AI assistant for residents of Montgomery, Alabama.

ROLE
You help residents navigate city services, understand next steps, and prepare ready-to-send issue reports.
You are calm, practical, human, and concise.
You should sound like a knowledgeable city staff member using modern tools.

IMPORTANT RULES
- Prioritize the provided Montgomery city data and department guide over general knowledge.
- Do not invent phone numbers, URLs, office hours, addresses, or alerts.
- If data is missing, be honest and keep the answer useful.
- Keep all content practical and resident-focused.
- If the request suggests immediate danger, active crime, fire, or medical emergency, set safetyLevel to "red" and clearly say to call 911.
- Mention late evening or weekend context only when relevant.
- Do not use markdown.
- Return valid JSON only.
- Do not wrap the JSON in backticks.

TIME CONTEXT
- Day: ${time.dayName}
- Local time: ${time.timeString}
- Weekend: ${time.isWeekend}

CITY DATA SUMMARY
${JSON.stringify(citySummary, null, 2)}

DEPARTMENT GUIDE
${JSON.stringify(deptGuide, null, 2)}

SAFETY BASELINE
${JSON.stringify(baseline, null, 2)}

TASK
Classify the user's question into the best matching categoryKey from this set:
sanitation, publicWorks, permits, businessLicense, police, fire, codeEnforcement, parks, traffic, ema, housing, council

Then return JSON in exactly this shape:
{
  "category": "short human-readable category",
  "categoryKey": "one allowed categoryKey",
  "steps": ["step 1", "step 2", "step 3"],
  "contactDept": "department name from department guide when possible",
  "contactPhone": "phone number from department guide when possible",
  "contactExtra": "brief extra contact info, city portal suggestion, or useful note",
  "safetyLevel": "green or yellow or red",
  "safetyNote": "brief, factual, relevant safety note",
  "conciergeNote": "warm and human 1-2 sentence closing, relevant to time of day or weekend if applicable",
  "sources": ["source 1", "source 2"],
  "reportSubject": "short formal subject line",
  "reportBody": "professional ready-to-send report text, 3-5 sentences"
}

QUALITY BAR
- category must be clear and specific
- steps must be actionable and short
- reportBody must be realistic and usable
- conciergeNote must feel human, not robotic
`.trim();
}

/**
 * Extract text from different backend/provider response shapes
 */
function extractModelText(data) {
  if (!data) return '';

  // Our own proxy format
  if (typeof data.reply === 'string') return data.reply;

  // Anthropic raw-ish
  if (Array.isArray(data.content) && data.content[0]?.text) {
    return data.content[0].text;
  }

  // OpenAI-like
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Gemini-ish custom wrapper
  if (typeof data.text === 'string') return data.text;

  return '';
}

/**
 * Extract JSON from model text even if model adds extra commentary
 */
function safeParseConciergeJson(rawText, query) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackRoute(query);
  }

  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return normalizeConciergeResponse(JSON.parse(cleaned), query);
  } catch (_) {
    // Try to extract first JSON object
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const sliced = cleaned.slice(start, end + 1);
        return normalizeConciergeResponse(JSON.parse(sliced), query);
      } catch (_) {
        return fallbackRoute(query);
      }
    }
    return fallbackRoute(query);
  }
}

/**
 * Ensure response shape is complete and safe
 */
function normalizeConciergeResponse(obj, query) {
  const fallback = fallbackRoute(query);

  return {
    category: obj?.category || fallback.category,
    categoryKey: obj?.categoryKey || fallback.categoryKey,
    steps: Array.isArray(obj?.steps) && obj.steps.length >= 1 ? obj.steps.slice(0, 3) : fallback.steps,
    contactDept: obj?.contactDept || fallback.contactDept,
    contactPhone: obj?.contactPhone || fallback.contactPhone,
    contactExtra: obj?.contactExtra || fallback.contactExtra,
    safetyLevel: ['green', 'yellow', 'red'].includes(obj?.safetyLevel) ? obj.safetyLevel : fallback.safetyLevel,
    safetyNote: obj?.safetyNote || fallback.safetyNote,
    conciergeNote: obj?.conciergeNote || getConciergeNote(),
    sources: Array.isArray(obj?.sources) && obj.sources.length ? obj.sources.slice(0, 3) : fallback.sources,
    reportSubject: obj?.reportSubject || fallback.reportSubject,
    reportBody: obj?.reportBody || fallback.reportBody
  };
}

/**
 * Ask the AI concierge
 * @param {string} query
 * @param {string} zip
 * @param {object} cityData
 * @returns {object}
 */
export async function askConcierge(query, zip, cityData) {
  if (!query || !query.trim()) {
    return fallbackRoute('general city help');
  }

  if (CONFIG.MODE === 'demo') {
    console.log('[Concierge] Demo mode — using fallback routing');
    return fallbackRoute(query);
  }

  const systemPrompt = buildSystemPrompt(query, cityData, zip);
  const { endpoint, model, maxTokens } = CONFIG.llm;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Resident question: ${query}${zip ? `\nZIP: ${zip}` : ''}`
          }
        ]
      })
    });

    if (res.status === 405 || res.status === 404) {
      console.log('[Concierge] Proxy not available (static hosting) — using fallback');
      return fallbackRoute(query);
    }

    if (!res.ok) {
      console.warn(`[Concierge] API returned ${res.status} — using fallback`);
      return fallbackRoute(query);
    }

    const data = await res.json();
    const rawText = extractModelText(data);
    return safeParseConciergeJson(rawText, query);

  } catch (err) {
    console.error('[Concierge] AI call failed, using fallback:', err);
    return fallbackRoute(query);
  }
}

/**
 * Keyword-based fallback when AI is unavailable
 */
export function fallbackRoute(query) {
  const q = (query || '').toLowerCase();
  let key = 'council';

  if (/trash|garbage|sanit|pickup|waste|dump|recycl|bulk/.test(q)) key = 'sanitation';
  else if (/pothole|road|street|pav|sidewalk|curb/.test(q)) key = 'publicWorks';
  else if (/business|license|vendor|entrepreneur/.test(q)) key = 'businessLicense';
  else if (/permit|construct|build|inspect|renovation/.test(q)) key = 'permits';
  else if (/crime|police|theft|break-in|safe|stolen|vandal/.test(q)) key = 'police';
  else if (/fire\s?station|smoke|fire\s?rescue|fire\b/.test(q)) key = 'fire';
  else if (/code|violation|property|abandon|blight|overgrown|vacant|vehicle/.test(q)) key = 'codeEnforcement';
  else if (/park|trail|recreation|playground|green/.test(q)) key = 'parks';
  else if (/traffic|signal|streetlight|light\s?out|crosswalk|road\s?clos/.test(q)) key = 'traffic';
  else if (/tornado|weather|emergency|shelter|siren|flood|storm/.test(q)) key = 'ema';
  else if (/zone|zoning|plan|develop|land\s?use|housing/.test(q)) key = 'housing';
  else if (/food|restaurant|health\s?score|inspection|hygiene/.test(q)) key = 'codeEnforcement';
  else if (/pharmacy|clinic|doctor|hospital|medical|community center/.test(q)) key = 'council';

  const svc = SERVICES[key] || SERVICES.council;
  const safety = inferSafetyFromQuery(q);

  return {
    category: svc.cat,
    categoryKey: key,
    steps: [
      `Contact ${svc.dept} for assistance.`,
      `Call ${svc.phone} during normal business hours if the issue is not urgent.`,
      'If available, use the city portal or 311 request flow to create a trackable record.'
    ],
    contactDept: svc.dept,
    contactPhone: svc.phone,
    contactExtra: 'Visit the official City of Montgomery website or 311 resources for the latest service details.',
    safetyLevel: safety.level,
    safetyNote: safety.note,
    conciergeNote: getConciergeNote(),
    sources: ['City of Montgomery Open Data', 'City Services Directory'],
    reportSubject: `Service Request: ${svc.cat}`,
    reportBody: buildFallbackReportBody(query, svc),
  };
}

function inferSafetyFromQuery(q) {
  if (/fire|smoke|active crime|break-in now|someone is following me|medical emergency|not breathing|gun|shooting/.test(q)) {
    return {
      level: 'red',
      note: 'This may require emergency response. If there is immediate danger or a medical emergency, call 911 now.'
    };
  }

  if (/crime|police|unsafe|storm|tornado|flood|shelter|traffic|streetlight|light out|road clos|pothole/.test(q)) {
    return {
      level: 'yellow',
      note: 'This request may involve safety or travel conditions. Check local advisories and use caution if heading out.'
    };
  }

  return {
    level: 'green',
    note: 'No active safety risk inferred from this request.'
  };
}

function buildFallbackReportBody(query, svc) {
  return `Hello,

I would like to request assistance regarding the following issue: ${query}.

Please let me know the next steps or direct me to the appropriate resource within ${svc.dept}. Thank you for your time and assistance.`;
}

/**
 * Human closing note
 */
export function getConciergeNote() {
  const { hour, dayIndex, isWeekend } = getTimeContext();

  if (hour >= 21) {
    return "It’s getting late, so online reporting may be the quickest option tonight. I hope this helps, and stay safe.";
  }

  if (hour < 7) {
    return "It’s still early, and many offices may not be open yet. You can usually prepare or submit your request online now and follow up later.";
  }

  if (isWeekend || dayIndex === 0 || dayIndex === 6) {
    return "Office hours may be limited this weekend, so online options are usually best. Hope this helps and have a good day.";
  }

  return "Hope this helps — and if you need anything else, I’m here to guide you.";
}
