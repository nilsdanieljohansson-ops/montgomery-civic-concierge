// /api/concierge.js

const MODEL = 'claude-3-haiku-20240307';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 12000;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

/* ─────────────────────────────────────
   SYSTEM PROMPT BUILDER
───────────────────────────────────── */

function buildSystemPrompt(systemText) {

  return `
You are Montgomery Civic Concierge, an AI assistant for residents of Montgomery, Alabama.

Your job is to help residents quickly find the right city service, understand what to do next, and prepare a practical report they can submit.

VOICE AND STYLE
- Be concise, calm, and useful.
- Sound like a knowledgeable civic assistant.
- Avoid generic chatbot language.
- Never use markdown.
- Always return valid JSON only.

PRIORITIES
- Use practical civic knowledge.
- Do not invent phone numbers or departments.
- If the request involves immediate danger, fire, medical emergency, or active crime:
  safetyLevel = "red"
  clearly advise calling 911.

TASK
Classify the resident request and return structured JSON.

ALLOWED categoryKey values:
sanitation
publicWorks
permits
businessLicense
police
fire
codeEnforcement
parks
traffic
ema
housing
council

RESPONSE RULES
- category should be short and readable
- steps must contain exactly 3 actionable steps
- contactDept should match a realistic Montgomery department
- contactPhone should be a plausible city contact
- safetyLevel must be green, yellow, or red
- conciergeNote should be warm and human
- reportBody should be a realistic message a resident could send

RETURN EXACT JSON STRUCTURE

{
  "category": "short category",
  "categoryKey": "allowed key",
  "steps": ["step 1", "step 2", "step 3"],
  "contactDept": "department name",
  "contactPhone": "phone number",
  "contactExtra": "extra contact guidance",
  "safetyLevel": "green or yellow or red",
  "safetyNote": "brief safety note",
  "conciergeNote": "short friendly closing note",
  "sources": ["source 1", "source 2"],
  "reportSubject": "formal subject line",
  "reportBody": "professional ready-to-send report"
}

${systemText || ''}

`.trim();
}

/* ─────────────────────────────────────
   BUILD USER PROMPT
───────────────────────────────────── */

function buildUserPrompt(messages = []) {

  if (!Array.isArray(messages) || !messages.length) {
    return "Resident request: Please help with a city service issue.";
  }

  return messages
    .map(m => {

      const role = m?.role || 'user';
      const content =
        typeof m?.content === 'string'
          ? m.content
          : JSON.stringify(m?.content || '');

      return `${role.toUpperCase()}: ${content}`;

    })
    .join('\n\n');
}

/* ─────────────────────────────────────
   CLAUDE RESPONSE HELPERS
───────────────────────────────────── */

function extractClaudeText(data) {

  if (!data || !Array.isArray(data.content)) return '';

  return data.content
    .filter(item => item?.type === 'text')
    .map(item => item.text)
    .join('\n')
    .trim();
}

function sanitizeModelText(text) {

  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function safeJsonObject(text) {

  const cleaned = sanitizeModelText(text);

  try {
    return JSON.parse(cleaned);
  } catch {

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

/* ─────────────────────────────────────
   NORMALIZE OUTPUT
───────────────────────────────────── */

function normalizePayload(payload) {

  const allowedKeys = new Set([
    'sanitation',
    'publicWorks',
    'permits',
    'businessLicense',
    'police',
    'fire',
    'codeEnforcement',
    'parks',
    'traffic',
    'ema',
    'housing',
    'council'
  ]);

  const safe = payload && typeof payload === 'object' ? payload : {};

  return {

    category: safe.category || 'General City Assistance',

    categoryKey: allowedKeys.has(safe.categoryKey)
      ? safe.categoryKey
      : 'council',

    steps: Array.isArray(safe.steps)
      ? safe.steps.slice(0, 3)
      : [
          'Review the issue details.',
          'Contact the appropriate city department.',
          'Submit a city service request for tracking.'
        ],

    contactDept: safe.contactDept || 'City of Montgomery',

    contactPhone: safe.contactPhone || '311',

    contactExtra:
      safe.contactExtra ||
      'Visit the official Montgomery city website for service information.',

    safetyLevel: ['green', 'yellow', 'red'].includes(safe.safetyLevel)
      ? safe.safetyLevel
      : 'green',

    safetyNote:
      safe.safetyNote ||
      'No immediate safety concern identified from the request.',

    conciergeNote:
      safe.conciergeNote ||
      'Hope this helps. Let me know if you need anything else.',

    sources: Array.isArray(safe.sources)
      ? safe.sources.slice(0, 3)
      : ['Montgomery Open Data', 'City Services Directory'],

    reportSubject:
      safe.reportSubject || 'City Service Request',

    reportBody:
      safe.reportBody ||
      `Hello,

I would like to report an issue in the community and request assistance.

Please advise on the next steps or direct me to the correct department.

Thank you.`
  };
}

/* ─────────────────────────────────────
   CALL ANTHROPIC API
───────────────────────────────────── */

async function fetchAnthropic({
  system,
  userPrompt,
  model,
  maxTokens,
  apiKey
}) {

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',

        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },

        body: JSON.stringify({
          model: model || MODEL,
          max_tokens: Number(maxTokens) || 500,
          system,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ]
        }),

        signal: controller.signal
      }
    );

    const raw = await response.text();

    let data = null;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {

      return {
        ok: false,
        status: response.status,
        error: data?.error?.message || data?.error || raw
      };
    }

    return {
      ok: true,
      status: response.status,
      data
    };

  } finally {
    clearTimeout(timeout);
  }
}

/* ─────────────────────────────────────
   API HANDLER
───────────────────────────────────── */

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error: 'Missing ANTHROPIC_API_KEY in environment variables'
    });
  }

  const body =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  const {
    system = '',
    messages = [],
    model = MODEL,
    max_tokens = 500
  } = body;

  if (!Array.isArray(messages) || !messages.length) {

    return json(res, 400, {
      error: 'Missing messages[]'
    });
  }

  const systemPrompt = buildSystemPrompt(system);
  const userPrompt = buildUserPrompt(messages);

  try {

    const result = await fetchAnthropic({
      system: systemPrompt,
      userPrompt,
      model,
      maxTokens: max_tokens,
      apiKey
    });

    if (!result.ok) {

      return json(res, result.status || 500, {
        error: result.error || 'Anthropic request failed'
      });
    }

    const rawText = extractClaudeText(result.data);

    const parsed = safeJsonObject(rawText);

    const normalized = normalizePayload(parsed);

    return json(res, 200, {

      ok: true,
      provider: 'anthropic',
      model,

      content: [
        {
          type: 'text',
          text: JSON.stringify(normalized)
        }
      ],

      parsed: normalized
    });

  } catch (error) {

    const isAbort = error?.name === 'AbortError';

    return json(res, isAbort ? 504 : 500, {

      error: isAbort
        ? 'Anthropic request timed out'
        : 'Internal server error'
    });
  }
}
