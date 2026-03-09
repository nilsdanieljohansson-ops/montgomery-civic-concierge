// ════════════════════════════════════════════
// CONCIERGE — Prompt orchestration & routing
// Provider-agnostic: works with Claude, GPT, Gemini
// Updated with localContext support and improved fallback behavior
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

  const shelterPreview = shelters
    .slice(0, 2)
    .map((item) => item?.attributes || item)
    .filter(Boolean);

  const pavingPreview = paving
    .slice(0, 2)
    .map((item) => item?.attributes || item)
    .filter(Boolean);

  const requestPreview = requests311
    .slice(0, 2)
    .map((item) => item?.attributes || item)
    .filter(Boolean);

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
      pavingSample: pavingPreview,
      request311Sample: requestPreview
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

  if (/fire in my building|building on fire|house on fire|medical emergency|not breathing|active crime|shooting|gun/i.test(q)) {
    return {
      level: 'red',
      note: 'Possible active emergency detected. If there is immediate danger, call 911 now.'
    };
  }

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

  if (/road|pothole|street|traffic|closure|construction|detour|sidewalk|streetlight|light out/.test(q)) {
    if (paving > 0) {
      return {
        level: 'yellow',
        note: `${paving} infrastructure or paving record(s) are currently loaded and may affect travel routes.`
      };
    }
  }

  if (/crime|police|theft|break-in|unsafe|stolen|vandal/.test(q)) {
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
function buildSystemPrompt(query, cityData, zip, localContext = '') {
  const time = getTimeContext();
  const citySummary = buildCitySummary(cityData, zip);
  const deptGuide = buildDepartmentGuide();
  const baseline = inferSafetyBaseline(query, cityData);

  return `
You are Montgomery Civic Concierge, an AI assistant for residents of Montgomery, Alabama.

ROLE
You help residents navigate city services, understand next steps, and prepare ready-to-send issue reports or information inquiries.
You are calm, practical, human, and concise.
You should sound like a knowledgeable civic assistant using modern tools.

IMPORTANT RULES
- Prioritize the provided Montgomery city data, local context, and department guide over general knowledge.
- Do not invent phone numbers, URLs, office hours, addresses, alerts, or service procedures.
- If data is missing, be honest and keep the answer useful.
- Keep all content practical and resident-focused.
- If the request suggests immediate danger, active crime, fire, or medical emergency, set safetyLevel to "red" and clearly say to call 911.
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

LOCAL CONTEXT
${localContext || 'No additional local context was provided.'}

LOCAL CONTEXT RULE
- If local context is provided, use it to improve relevance, phrasing, and routing.
- Do not claim exact locations, nearest matches, availability, or official details unless explicitly supported by the context.
- Use local context to make the answer feel more specific to Montgomery.

REPORT WRITING RULES
- Make reportSubject and reportBody specific to the user's request.
- Avoid repetitive generic phrases.
- Write like a real resident preparing a useful city request.
- Keep the tone professional, practical, and concise.
- For issue reports, clearly describe the issue and request guidance or action.
- For information requests, write a short inquiry, not a complaint or incident report.
- Do not invent addresses, dates, names, phone numbers, or incident details.
- Use placeholders like [address], [location], or [date] only when needed.

MODE RULE
- If the user is reporting a city problem, write the report as a service report.
- If the user is asking for location or service information, write the report as an information inquiry.
- Do not frame information requests as incidents.

LOCATION REQUEST RULE
If the user asks for location information such as:
- "where is"
- "nearest"
- "find nearby"
- "closest"

Treat this as an informational request, not a service issue.
Use safetyLevel = "green" unless danger is explicitly described.

Examples of information requests:
- "Where is the nearest fire station?"
- "Where is the nearest tornado shelter?"
- "Find a nearby pharmacy"
- "Where are the closest parks?"

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
  "reportBody": "professional ready-to-send report text, 2-5 sentences"
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

  if (typeof data.reply === 'string') return data.reply;

  if (Array.isArray(data.content) && data.content[0]?.text) {
    return data.content[0].text;
  }

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  if (typeof data.text === 'string') return data.text;

  if (data.parsed && typeof data.parsed === 'object') {
    return JSON.stringify(data.parsed);
  }

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
 * @param {string} localContext
 * @returns {object}
 */
export async function askConcierge(query, zip, cityData, localContext = '') {
  if (!query || !query.trim()) {
    return fallbackRoute('general city help');
  }

  if (CONFIG.MODE === 'demo') {
    console.log('[Concierge] Demo mode — using fallback routing');
    return fallbackRoute(query);
  }

  const systemPrompt = buildSystemPrompt(query, cityData, zip, localContext);
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
            content: `Resident question: ${query}${zip ? `\nZIP: ${zip}` : ''}${localContext ? `\n\nAdditional local civic context:\n${localContext}` : ''}`
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
  else if (/pothole|road|street|pav|sidewalk|curb|drain|streetlight|light out/.test(q)) key = 'publicWorks';
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
  const isInfoRequest = /where is|nearest|find nearby|closest|location|hours|address|phone number|information/i.test(q);

  return {
    category: isInfoRequest ? `${svc.cat} Information` : svc.cat,
    categoryKey: key,
    steps: buildFallbackSteps(q, svc, isInfoRequest),
    contactDept: svc.dept,
    contactPhone: svc.phone,
    contactExtra: 'Visit the official City of Montgomery website or 311 resources for the latest service details.',
    safetyLevel: safety.level,
    safetyNote: safety.note,
    conciergeNote: getConciergeNote(),
    sources: ['City of Montgomery Open Data', 'City Services Directory'],
    reportSubject: buildFallbackSubject(q, svc, isInfoRequest),
    reportBody: buildFallbackReportBody(query, svc, isInfoRequest)
  };
}

function inferSafetyFromQuery(q) {
  if (/fire in my building|building on fire|medical emergency|not breathing|gun|shooting|active crime/.test(q)) {
    return {
      level: 'red',
      note: 'This may require emergency response. If there is immediate danger or a medical emergency, call 911 now.'
    };
  }

  if (/storm warning|tornado warning|flood warning|active fire|smoke in building/.test(q)) {
    return {
      level: 'red',
      note: 'This may indicate an active emergency. Move to safety and call 911 if immediate help is needed.'
    };
  }

  if (/crime|police|unsafe|storm|tornado|flood|shelter|traffic|streetlight|light out|road clos|pothole/.test(q)) {
    if (/where is|nearest|find nearby|closest|location|information/.test(q)) {
      return {
        level: 'green',
        note: 'This is an information request. Check official city resources for the latest details.'
      };
    }

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

function buildFallbackSteps(q, svc, isInfoRequest) {
  if (isInfoRequest) {
    return [
      `Contact ${svc.dept} for location or service information.`,
      `Ask for the nearest or most relevant option for your area.`,
      'Confirm any address, access details, or hours before traveling.'
    ];
  }

  return [
    `Contact ${svc.dept} for assistance.`,
    `Call ${svc.phone} during normal business hours if the issue is not urgent.`,
    'If available, use the city portal or 311 request flow to create a trackable record.'
  ];
}

function buildFallbackSubject(q, svc, isInfoRequest) {
  if (isInfoRequest) {
    return `${svc.cat} Information Request`;
  }
  return `Service Request: ${svc.cat}`;
}

function buildFallbackReportBody(query, svc, isInfoRequest) {
  if (isInfoRequest) {
    return `Hello,

I am requesting information related to ${svc.cat.toLowerCase()} in Montgomery regarding: ${query}.

Please let me know the correct location, contact point, or next step for this request.

Thank you.`;
  }

  return `Hello,

I would like to report the following issue: ${query}.

Please let me know the next steps or direct me to the appropriate resource within ${svc.dept}.

Thank you.`;
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
