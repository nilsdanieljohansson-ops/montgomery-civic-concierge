// ════════════════════════════════════════════
// CONFIG — Central configuration
// Single place to change API keys, modes, flags
// ════════════════════════════════════════════

export const CONFIG = {

  // ── Mode ──
  // Set to true to use local demo data instead of live APIs
  // Flip this if APIs are down during demo
  USE_DEMO_DATA: false,

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