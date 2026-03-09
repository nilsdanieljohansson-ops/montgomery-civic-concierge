const MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 12000;

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
}

function buildSystemPrompt(extraText = '') {
  return `
You are Montgomery Civic Concierge, an AI assistant for residents of Montgomery, Alabama.

Your job is to help residents identify the most likely city service category, understand next steps, and prepare a practical report they can submit.

VOICE AND STYLE
- Be concise, calm, and useful.
- Sound like a knowledgeable civic assistant.
- Avoid generic chatbot language.
- Never use markdown.
- Always return valid JSON only.
- Do not include any text before or after the JSON object.

SAFETY
- If the request involves immediate danger, fire, medical emergency, active crime, or urgent personal safety risk:
  - set safetyLevel to "red"
  - clearly advise calling 911 in safetyNote
- If the issue is hazardous but not clearly an emergency, use "yellow".
- Otherwise use "green".

STRICT RELIABILITY RULES
- Do not invent phone numbers.
- Do not invent department names.
- Do not invent response times.
- Do not invent hotline names.
- Do not invent websites, emails, or reporting channels.
- If uncertain, use conservative generic wording.
- If uncertain about a direct contact, use:
  - contactDept = "City of Montgomery"
  - contactPhone = "311"
  - contactExtra = "Check the official City of Montgomery website or 311 service for current contact and reporting details."
- sources must be generic plain-text source labels only, not URLs.
- Never claim a turnaround time unless explicitly provided in the user request.
- Never say "typically responds in X days" unless that exact fact is given by the user.

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

CATEGORY MAPPING GUIDANCE
- sanitation: trash, garbage, bulk pickup, missed collection, litter
- publicWorks: potholes, drainage, streets, sidewalks, stormwater, road maintenance
- permits: building permits, inspections, construction approvals
- businessLicense: business registration, business licensing, renewals
- police: non-emergency police matters, theft reports, suspicious activity
- fire: non-emergency fire department matters, fire prevention questions
- codeEnforcement: weeds, unsafe property, abandoned structures, nuisance property
- parks: parks, playgrounds, fields, recreation spaces
- traffic: signals, signs, speeding concerns, street markings
- ema: severe weather prep, disaster response, emergency management
- housing: housing assistance, housing conditions, basic housing support
- council: city council, general government questions, uncertain routing

JSON RULES
- Return exactly one JSON object.
- steps must contain exactly 3 short strings.
- sources should contain 1 to 3 short strings.
- reportSubject must be short and formal.
- reportBody must be plain text, professional, and ready to send.
- No markdown, no code fences, no explanations.

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

  return {
    category: typeof safe.category === 'string' ? safe.category : 'General City Assistance',
    categoryKey: allowedKeys.has(safe.categoryKey) ? safe.categoryKey : 'council',
    steps: Array.isArray(safe.steps) ? safe.steps.slice(0, 3).map(String) : [
      'Review the issue details.',
      'Contact the relevant city department.',
      'Submit a trackable city request if available.'
    ],
    contactDept: typeof safe.contactDept === 'string' ? safe.contactDept : 'City of Montgomery',
    contactPhone: typeof safe.contactPhone === 'string' ? safe.contactPhone : '311',
    contactExtra: typeof safe.contactExtra === 'string' ? safe.contactExtra : 'Check the official city website for updated service details.',
    safetyLevel: ['green', 'yellow', 'red'].includes(safe.safetyLevel) ? safe.safetyLevel : 'green',
    safetyNote: typeof safe.safetyNote === 'string' ? safe.safetyNote : 'No specific safety concern was identified from this request.',
    conciergeNote: typeof safe.conciergeNote === 'string' ? safe.conciergeNote : 'Hope this helps.',
    sources: Array.isArray(safe.sources) ? safe.sources.slice(0, 3).map(String) : ['Montgomery Open Data', 'City Services Directory'],
    reportSubject: typeof safe.reportSubject === 'string' ? safe.reportSubject : 'City Service Request',
    reportBody: typeof safe.reportBody === 'string'
      ? safe.reportBody
      : 'Hello,\n\nI would like assistance with a city service request. Please advise on the next steps.\n\nThank you.'
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
      body = typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});
    } catch (e) {
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
    const normalized = normalizePayload(parsed);

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
    console.error('api/concierge fatal error:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Internal server error'
    });
  }
}
