const MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 12000;

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
}

function buildSystemPrompt(extraText = '') {
  return `
You are Montgomery Civic Concierge, an AI assistant helping residents of Montgomery, Alabama navigate city services.

Your job is to interpret a resident's request, classify the correct city service category, suggest next steps, and generate a helpful draft message they could send to the appropriate department.

VOICE AND STYLE
- Be concise, calm, and practical.
- Sound like a knowledgeable civic assistant.
- Avoid generic chatbot language.
- Never use markdown.
- Always return valid JSON only.
- Do not include any text before or after the JSON object.

SAFETY RULES
- If the request involves immediate danger, fire, medical emergency, active crime, or urgent personal safety risk:
  safetyLevel = "red"
  clearly advise calling 911 in safetyNote.
- If the issue may involve risk but not an emergency, use safetyLevel = "yellow".
- Otherwise use safetyLevel = "green".

RELIABILITY RULES
- Never invent phone numbers, departments, or contact channels.
- Never invent response times or official procedures.
- If uncertain about contact details, use the safe fallback:
  contactDept = "City of Montgomery"
  contactPhone = "311"
  contactExtra = "Check the official City of Montgomery website or 311 service for current contact and reporting details."
- sources must be plain text labels, not URLs.
- Never invent addresses, dates, names, or incident details.
- If needed, use placeholders like [address] or [location].

REPORT WRITING RULES
- Make reportSubject and reportBody specific to the user’s request.
- Avoid repetitive generic phrases.
- Write like a real resident preparing a useful city request.
- Keep the tone professional and concise.

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

Treat it as an informational request, not a service issue.
Use safetyLevel = "green" unless danger is explicitly described.

Examples of information requests:
- "Where is the nearest fire station?"
- "Where is the nearest tornado shelter?"
- "Find a nearby pharmacy"
- "Where are the closest parks?"

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

CATEGORY GUIDANCE
- sanitation: trash, garbage, missed pickup, litter
- publicWorks: potholes, drainage, streets, sidewalks, stormwater
- permits: building permits, construction approvals
- businessLicense: business registration and licensing
- police: non-emergency police issues
- fire: non-emergency fire department matters, fire station information
- codeEnforcement: weeds, abandoned property, unsafe buildings
- parks: parks, playgrounds, recreation spaces
- traffic: signals, signs, speeding concerns
- ema: disaster preparation, tornado shelters, emergency management
- housing: housing assistance or conditions
- council: general government questions or uncertain routing

JSON RULES
- Return exactly one JSON object.
- steps must contain exactly 3 short strings.
- sources must contain 1–3 short strings.
- reportSubject must be short and formal.
- reportBody must be plain text and ready to send.

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

${String(extraText || '')}
`.trim();
}

function buildUserPrompt(messages = []) {
  if (!Array.isArray(messages) || !messages.length) {
    return 'Resident request: Please help with a city service issue.';
  }

  return messages
    .map((m) => {
      const role = m?.role || 'user';
      const content =
        typeof m?.content === 'string'
          ? m.content
          : JSON.stringify(m?.content || '');
      return `${role.toUpperCase()}: ${content}`;
    })
    .join('\n\n');
}

function extractClaudeText(data) {
  if (!data || !Array.isArray(data.content)) return '';

  return data.content
    .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

function safeJsonObject(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

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

  const cleanString = (value, fallback, max = 300) => {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, max) : fallback;
  };

  const cleanLines = (value, fallback, max = 1200) => {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/\r/g, '').trim();
    return cleaned ? cleaned.slice(0, max) : fallback;
  };

  const cleanArray = (value, fallback, maxItems = 3, maxLen = 160) => {
    if (!Array.isArray(value)) return fallback;
    const items = value
      .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((item) => item.slice(0, maxLen));
    return items.length ? items : fallback;
  };

  const categoryKey = allowedKeys.has(safe.categoryKey) ? safe.categoryKey : 'council';

  return {
    category: cleanString(safe.category, 'General City Assistance', 80),
    categoryKey,
    steps: cleanArray(
      safe.steps,
      [
        'Review the issue details.',
        'Contact the relevant city department.',
        'Submit a trackable city request if available.'
      ],
      3,
      120
    ),
    contactDept: cleanString(safe.contactDept, 'City of Montgomery', 120),
    contactPhone: cleanString(safe.contactPhone, '311', 60),
    contactExtra: cleanString(
      safe.contactExtra,
      'Check the official city website for updated service details.',
      220
    ),
    safetyLevel: ['green', 'yellow', 'red'].includes(safe.safetyLevel)
      ? safe.safetyLevel
      : 'green',
    safetyNote: cleanString(
      safe.safetyNote,
      'No specific safety concern was identified from this request.',
      220
    ),
    conciergeNote: cleanString(safe.conciergeNote, 'Hope this helps.', 180),
    sources: cleanArray(
      safe.sources,
      ['City of Montgomery official information'],
      3,
      100
    ),
    reportSubject: cleanString(safe.reportSubject, 'City Service Request', 120),
    reportBody: cleanLines(
      safe.reportBody,
      'Hello,\n\nI would like assistance with a city service request. Please advise on the next steps.\n\nThank you.',
      1500
    )
  };
}

async function fetchAnthropic({ system, userPrompt, model, maxTokens, apiKey }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model || MODEL,
        max_tokens: Number(maxTokens) || 500,
        temperature: 0,
        system,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      }),
      signal: controller.signal
    });

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
        error: data?.error?.message || data?.error || raw || 'Anthropic request failed'
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

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        error: 'Missing ANTHROPIC_API_KEY in environment variables'
      });
    }

    let body = {};
    try {
      body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});
    } catch {
      return sendJson(res, 400, {
        error: 'Invalid JSON request body'
      });
    }

    const {
      system = '',
      messages = [],
      model = MODEL,
      max_tokens = 500
    } = body;

    if (!Array.isArray(messages) || !messages.length) {
      return sendJson(res, 400, {
        error: 'Missing messages[]'
      });
    }

    const systemPrompt = buildSystemPrompt(system);
    const userPrompt = buildUserPrompt(messages);

    const result = await fetchAnthropic({
      system: systemPrompt,
      userPrompt,
      model,
      maxTokens: max_tokens,
      apiKey
    });

    if (!result.ok) {
      return sendJson(res, result.status || 500, {
        error: result.error || 'Anthropic request failed'
      });
    }

    const rawText = extractClaudeText(result.data);
    const parsed = safeJsonObject(rawText);
    const normalized = normalizePayload(parsed || {});

    return sendJson(res, 200, {
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
    console.error('api/claude fatal error:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Internal server error'
    });
  }
}
