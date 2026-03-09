// /api/concierge.js

const MODEL = 'claude-3-haiku-20240307';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 12000;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

function buildUserPrompt(messages = []) {
  if (!Array.isArray(messages) || !messages.length) {
    return 'Resident question: Please help with a city service request.';
  }

  return messages
    .map((m) => {
      const role = m?.role || 'user';
      const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '');
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
  } catch (_) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (_) {
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
    } catch (_) {
      data = { raw };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error?.message || data?.error || raw || 'Anthropic request failed',
        raw: data
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
  // Helpful CORS for testing from previews or other origins if needed
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const {
    system = '',
    messages = [],
    model = MODEL,
    max_tokens = 500
  } = body;

  if (!system || !Array.isArray(messages) || !messages.length) {
    return json(res, 400, {
      error: 'Missing required fields: system and messages[]'
    });
  }

  const userPrompt = buildUserPrompt(messages);

  try {
    const result = await fetchAnthropic({
      system,
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
      error: isAbort ? 'Anthropic request timed out' : 'Internal server error'
    });
  }
}
