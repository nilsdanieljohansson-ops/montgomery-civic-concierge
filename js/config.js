// ════════════════════════════════════════════
// CONFIG — Central configuration
// Single place to change API keys, modes, flags
// ════════════════════════════════════════════

export const CONFIG = {

  // ── Mode ──
  // 'auto'  = try live APIs first, fall back to demo if they fail
  // 'live'  = only use live APIs (errors shown if they fail)
  // 'demo'  = only use local demo data (no API calls at all)
  MODE: 'auto',

  // Helper getters
  get USE_DEMO_DATA() { return this.MODE === 'demo'; },
  get USE_LIVE_DATA() { return this.MODE === 'live'; },

  // ── Claude / LLM ──
  llm: {
    provider: 'anthropic',           // 'anthropic' | 'openai' | 'gemini'
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1000,
    // API key — in production, use a serverless proxy instead
    // For hackathon demo, this is acceptable
    apiKey: '',
  },

  // ── Bright Data ──
  brightData: {
    enabled: true,
    apiToken: '',
    datasetId: '',
    get triggerUrl() {
      return `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${this.datasetId}&custom_output_fields=markdown`;
    },
    get snapshotUrl() {
      return 'https://api.brightdata.com/datasets/v3/snapshot';
    },
    // Timeout for polling results (ms)
    pollTimeout: 30000,
    pollInterval: 3000,
  },

  // ── ArcGIS ──
  arcgis: {
    defaultRecordCount: 50,
    maxRecordCount: 200,
    // Set to true if you need a CORS proxy
    useProxy: false,
    proxyUrl: '',  // e.g. 'https://your-proxy.vercel.app/api/arcgis'
  },

  // ── Feature Flags ──
  features: {
    safetyBadge: true,
    cityPulse: true,
    reportGenerator: true,
    dataTester: true,
    brightDataSection: true,
    conciergeNotes: true,
  },

  // ── Demo Data Paths ──
  demoPaths: {
    pulse: './data/pulse-demo.json',
    services: './data/services-demo.json',
    badge: './data/badge-demo.json',
    brightData: './data/brightdata-demo.json',
  },
};