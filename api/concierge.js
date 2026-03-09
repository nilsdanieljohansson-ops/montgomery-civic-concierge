// ════════════════════════════════════════════
// CONCIERGE — Prompt orchestration & routing
// Provider-agnostic frontend client
// Upgraded with Bright Data context + stronger fallback
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';
import { CONFIG } from './config.js';

/* ─────────────────────────────────────
   Helpers
───────────────────────────────────── */

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

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function truncate(str, n = 180) {
  const s = String(str || '').trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function extractBrightDataSummary(brightData = []) {
  const items = arr(brightData);

  return items.slice(0, 4).map((item, i) => ({
    title: item?.title || item?.headline || `Web signal ${i + 1}`,
    summary: truncate(
      item?.summary ||
      item?.description ||
      item?.text ||
      item?.snippet ||
      ''
    ),
    source: item?.source || 'Bright Data',
    category: item?.category || 'web'
  }));
}

function buildDepartmentGuide() {
  return Object.entries(SERVICES).map(([key, value]) => ({
    key,
    category: value.cat,
    department: value.dept,
    phone: value.phone
  }));
}

function buildCitySummary(cityData = {}, zip = '') {
  const shelters = arr(cityData.shelters);
  const sirens = arr(cityData.sirens);
  const calls911 = arr(cityData.calls911);
  const requests311 = arr(cityData.requests311);
  const paving = arr(cityData.paving);
  const permits = arr(cityData.permits);
  const stations = arr(cityData.stations);

  return {
    zip: zip || null,
    liveData: {
      tornadoSheltersCount: shelters.length,
      weatherSirensCount: sirens.length,
      calls911Count: calls911.length,
      requests311Count: requests311.length,
      pavingProjectsCount: paving.length,
      permitsCount: permits.length,
      stationsCount: stations.length
    },
    examples: {
      shelterSample: shelters.slice(0, 2).map(x => x?.attributes || x),
      pavingSample: paving.slice(0, 2).map(x => x?.attributes || x),
      requests311Sample: requests311.slice(0, 2).map(x => x?.attributes || x)
    }
  };
}

function inferSafetyBaseline(query, cityData = {}, brightData = []) {
  const q = String(query || '').toLowerCase();
  const shelters = arr(cityData.shelters).length;
  const sirens = arr(cityData.sirens).length;
  const paving = arr(cityData.paving).length;
  const brightSignals = extractBrightDataSummary(brightData);

  const hasWeatherSignal = brightSignals.some(s =>
    /weather|storm|flood|tornado|ema|alert/i.test(`${s.title} ${s.summary}`)
  );

  const hasRoadSignal = brightSignals.some(s =>
    /road|closure|traffic|construction|detour|lane/i.test(`${s.title} ${s.summary}`)
  );

  if (/fire|smoke|medical emergency|not breathing|shooting|gun|active crime|break-in now/.test(q)) {
    return {
      level: 'red',
      note: 'Potential emergency detected. If there is immediate danger, fire, or a medical emergency, call 911 now.'
    };
  }

  if (/tornado|storm|weather|shelter|flood|emergency|siren/.test(q)) {
    if (shelters > 0 || sirens > 0 || hasWeatherSignal) {
      return {
        level: 'yellow',
        note: `Weather-related concern detected. ${shelters} shelter(s), ${sirens} siren record(s), and current web alerts may be relevant.`
      };
    }
    return {
      level: 'yellow',
      note: 'Weather-related concern detected. Check local emergency guidance before traveling.'
    };
  }

  if (/road|pothole|street|traffic|closure|construction|detour|sidewalk|streetlight/.test(q)) {
    if (paving > 0 || hasRoadSignal) {
      return {
        level: 'yellow',
        note: `Travel or infrastructure issue detected. ${paving} paving/infrastructure record(s) and current road-related web signals may affect routes.`
      };
    }
  }

  if (/crime|police|unsafe|theft|stolen|vandal/.test(q)) {
    return {
      level: 'yellow',
      note: 'Safety-related concern detected. Use caution and contact police or emergency services if the situation is active.'
    };
  }

  return {
    level: 'green',
    note: 'No direct safety risk inferred from this request.'
  };
}

/* ─────────────────────────────────────
   System prompt
───────────────────────────────────── */

function buildSystemPrompt(query, cityData, zip, brightData = []) {
  const time = getTimeContext();
  const citySummary = buildCitySummary(cityData, zip);
  const deptGuide = buildDepartmentGuide();
  const baseline = inferSafetyBaseline(query, cityData, brightData);
  const webSummary = extractBrightDataSummary(brightData);

  return `
You are Montgomery Civic Concierge, an AI assistant for residents of Montgomery, Alabama.

ROLE
You help residents navigate city services, understand next steps, and prepare ready-to-send issue reports.
You are calm, practical, human, and concise.
You should sound like a knowledgeable city staff member using modern tools.

IMPORTANT RULES
- Prioritize the provided Montgomery city data and department guide over general knowledge.
- Use Bright Data web signals only as supporting context, not as a reason to invent facts.
- Do not invent phone numbers, URLs, office hours, addresses, or active alerts.
- If data is missing, be honest and keep the answer useful.
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

WEB SIGNALS SUMMARY (Bright Data)
${JSON.stringify(webSummary, null, 2)}

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
  "reportBody": "professional ready-to-send report text, 3-5 sentences written like a real resident message"
}

QUALITY BAR
- category must be clear and specific
- steps must be actionable and short
- reportBody must be realistic and usable
- conciergeNote must feel human, not robotic
- if possible, mention the most relevant city data or web signal in safetyNote or contactExtra
`.trim();
}

/* ─────────────────────────────────────
   Response parsing
───────────────────────────────────── */

function extractModelText(data) {
  if (!data) return '';
  if (typeof data.reply === 'string') return data.reply;
  if (Array.isArray(data.content) && data.content[0]?.text) return data.content[0].text;
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (typeof data.text === 'string') return data.text;
  return '';
}

function safeParseConciergeJson(rawText, query, zip, cityData, brightData) {
  if (!rawText || typeof rawText !== 'string') {
    return fallbackRoute(query, zip, cityData, brightData);
  }

  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return normalizeConciergeResponse(JSON.parse(cleaned), query, zip, cityData, brightData);
  } catch (_) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return normalizeConciergeResponse(JSON.parse(cleaned.slice(start, end + 1)), query, zip, cityData, brightData);
      } catch (_) {
        return fallbackRoute(query, zip, cityData, brightData);
      }
    }
    return fallbackRoute(query, zip, cityData, brightData);
  }
}

function normalizeConciergeResponse(obj, query, zip, cityData, brightData) {
  const fallback = fallbackRoute(query, zip, cityData, brightData);

  return {
    category: obj?.category || fallback.category,
    categoryKey: obj?.categoryKey || fallback.categoryKey,
    steps: Array.isArray(obj?.steps) && obj.steps.length ? obj.steps.slice(0, 3) : fallback.steps,
    contactDept: obj?.contactDept || fallback.contactDept,
    contactPhone: obj?.contactPhone || fallback.contactPhone,
    contactExtra: obj?.contactExtra || fallback.contactExtra,
    safetyLevel: ['green', 'yellow', 'red'].includes(obj?.safetyLevel) ? obj.safetyLevel : fallback.safetyLevel,
    safetyNote: obj?.safetyNote || fallback.safetyNote,
    conciergeNote: obj?.conciergeNote || fallback.conciergeNote,
    sources: Array.isArray(obj?.sources) && obj.sources.length ? obj.sources.slice(0, 3) : fallback.sources,
    reportSubject: obj?.reportSubject || fallback.reportSubject,
    reportBody: obj?.reportBody || fallback.reportBody
  };
}

/* ─────────────────────────────────────
   Main AI call
───────────────────────────────────── */

export async function askConcierge(query, zip, cityData, brightData = []) {
  if (!query || !query.trim()) {
    return fallbackRoute('general city help', zip, cityData, brightData);
  }

  if (CONFIG.MODE === 'demo') {
    console.log('[Concierge] Demo mode — using fallback routing');
    return fallbackRoute(query, zip, cityData, brightData);
  }

  const systemPrompt = buildSystemPrompt(query, cityData, zip, brightData);
  const { endpoint, model, maxTokens } = CONFIG.llm;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

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
            content: `Resident request: ${query}${zip ? `\nZIP code: ${zip}` : ''}\nPlease classify the issue, identify the most relevant Montgomery department, provide 3 clear next steps, and generate a ready-to-send report.`
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.status === 405 || res.status === 404) {
      console.log('[Concierge] Proxy not available — using fallback');
      return fallbackRoute(query, zip, cityData, brightData);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[Concierge] API returned', res.status, err);
      return fallbackRoute(query, zip, cityData, brightData);
    }

    const data = await res.json();

    if (data?.parsed && typeof data.parsed === 'object') {
      return normalizeConciergeResponse(data.parsed, query, zip, cityData, brightData);
    }

    const rawText = extractModelText(data);
    return safeParseConciergeJson(rawText, query, zip, cityData, brightData);

  } catch (err) {
    console.error('[Concierge] AI call failed, using fallback:', err);
    return fallbackRoute(query, zip, cityData, brightData);
  }
}

/* ─────────────────────────────────────
   Smarter fallback
───────────────────────────────────── */

export function fallbackRoute(query, zip = '', cityData = {}, brightData = []) {
  const q = String(query || '').toLowerCase();
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
  const safety = inferSafetyBaseline(query, cityData, brightData);
  const brightSignals = extractBrightDataSummary(brightData);

  const locationLine = zip ? ` for ZIP code ${zip}` : '';
  const signalHint = brightSignals[0]?.title ? ` Recent web signal: ${brightSignals[0].title}.` : '';

  const steps = buildFallbackSteps(key, svc, zip, cityData);
  const report = buildFallbackReportBody(query, svc, zip);

  return {
    category: svc.cat,
    categoryKey: key,
    steps,
    contactDept: svc.dept,
    contactPhone: svc.phone,
    contactExtra: `Use the official Montgomery city website or 311 service flow for the latest details${locationLine}.${signalHint}`.trim(),
    safetyLevel: safety.level,
    safetyNote: safety.note,
    conciergeNote: getConciergeNote(key),
    sources: buildFallbackSources(key, brightSignals),
    reportSubject: buildFallbackSubject(query, svc),
    reportBody: report
  };
}

function buildFallbackSteps(key, svc, zip, cityData = {}) {
  const has311 = arr(cityData.requests311).length > 0;
  const hasShelters = arr(cityData.shelters).length > 0;
  const hasPaving = arr(cityData.paving).length > 0;

  switch (key) {
    case 'publicWorks':
      return [
        `Confirm the location of the issue${zip ? ` in or near ZIP ${zip}` : ''}.`,
        `Contact ${svc.dept} or use a city service request form to report it.`,
        hasPaving
          ? 'Mention nearby roadwork or construction if it may be related.'
          : 'Add a photo or landmarks if possible so the city can locate it faster.'
      ];

    case 'ema':
      return [
        hasShelters
          ? 'Check the nearest available tornado shelter before traveling.'
          : `Contact ${svc.dept} for the latest emergency guidance.`,
        'Monitor local weather and emergency updates.',
        'If conditions become dangerous, follow official emergency instructions immediately.'
      ];

    case 'businessLicense':
      return [
        `Contact ${svc.dept} to confirm the exact license or registration required.`,
        'Prepare your business type, address, and ownership details before applying.',
        'Ask whether additional permits or inspections are required before opening.'
      ];

    case 'permits':
      return [
        `Describe the project clearly before contacting ${svc.dept}.`,
        'Confirm which permit or inspection is required before work begins.',
        'Keep your property address, scope of work, and timeline ready.'
      ];

    case 'traffic':
      return [
        `Note the exact location of the signal, streetlight, or traffic issue.`,
        `Report it to ${svc.dept} as soon as possible.`,
        'Use caution in the area until the issue is resolved.'
      ];

    default:
      return [
        `Contact ${svc.dept} for assistance.`,
        `Call ${svc.phone} during normal business hours if the issue is not urgent.`,
        has311
          ? 'Use the city request system to create a trackable service record.'
          : 'Use the official city website to confirm the next step or reporting path.'
      ];
  }
}

function buildFallbackSources(key, brightSignals) {
  const base = ['Montgomery Open Data', 'City Services Directory'];
  if (key === 'ema') base.unshift('Emergency Management data');
  if (key === 'publicWorks' || key === 'traffic') base.unshift('Public Works data');
  if (brightSignals[0]?.source) base.push(brightSignals[0].source);
  return base.slice(0, 3);
}

function buildFallbackSubject(query, svc) {
  const q = String(query || '').trim();
  if (!q) return `Service Request: ${svc.cat}`;
  return `Service Request: ${svc.cat} — ${truncate(q, 55)}`;
}

function buildFallbackReportBody(query, svc, zip = '') {
  const locationLine = zip ? ` The issue is in or near ZIP code ${zip}.` : '';

  return `Hello,

I would like to request assistance regarding the following issue: ${query}.${locationLine}

Please let me know the next steps or direct me to the appropriate team within ${svc.dept}. Thank you for your time and assistance.`;
}

/* ─────────────────────────────────────
   Human closing note
───────────────────────────────────── */

export function getConciergeNote(categoryKey = '') {
  const { hour, isWeekend } = getTimeContext();

  if (categoryKey === 'ema') {
    return 'If weather conditions are changing quickly, rely on official emergency guidance first. I hope this helps and stay safe.';
  }

  if (hour >= 21) {
    return 'It’s getting late, so online reporting may be the quickest option tonight. I hope this helps.';
  }

  if (hour < 7) {
    return 'It’s still early, and many offices may not be open yet. You can usually prepare or submit your request online now and follow up later.';
  }

  if (isWeekend) {
    return 'Office hours may be limited this weekend, so online options are usually best. Hope this helps and have a good day.';
  }

  return 'Hope this helps — and if you need anything else, I’m here to guide you.';
}
