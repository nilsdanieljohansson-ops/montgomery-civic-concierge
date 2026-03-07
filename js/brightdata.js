// ════════════════════════════════════════════
// BRIGHT DATA — Live web data integration
// Crawls official Montgomery city pages for
// real-time updates not available in ArcGIS
// ════════════════════════════════════════════

import { CONFIG } from './config.js';

// Official Montgomery city pages to crawl
// These are public pages with alerts, news, and city updates
const CRAWL_TARGETS = [
  {
    key: 'city_news',
    label: 'City News & Announcements',
    url: 'https://www.montgomeryal.gov/news',
    category: 'announcements',
  },
  {
    key: 'city_alerts',
    label: 'City Alerts & Closures',
    url: 'https://www.montgomeryal.gov/residents/emergency-management',
    category: 'safety',
  },
  {
    key: 'city_events',
    label: 'Community Events',
    url: 'https://www.montgomeryal.gov/things-to-do/events',
    category: 'events',
  },
  {
    key: 'road_closures',
    label: 'Road Closures & Traffic',
    url: 'https://www.montgomeryal.gov/residents/street-closures',
    category: 'infrastructure',
  },
  {
    key: 'city_council',
    label: 'City Council Updates',
    url: 'https://www.montgomeryal.gov/government/city-council',
    category: 'government',
  },
];


// ── State ──
let brightDataResults = {};
let lastCrawlTime = null;


/**
 * Trigger a Bright Data crawl for all target URLs
 * Returns a snapshot_id for result retrieval
 */
export async function triggerCrawl() {
  const payload = CRAWL_TARGETS.map((t) => ({ url: t.url }));

  try {
    const res = await fetch(CONFIG.brightData.proxyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trigger',
        urls: payload,
      }),
    });

    if (!res.ok) {
      throw new Error(`Bright Data API returned ${res.status}`);
    }

    const data = await res.json();
    console.log('[Bright Data] Crawl triggered:', data.snapshot_id);
    return data.snapshot_id;
  } catch (err) {
    console.warn('[Bright Data] Trigger failed:', err.message);
    return null;
  }
}


/**
 * Fetch crawl results by snapshot ID
 */
export async function fetchCrawlResults(snapshotId) {
  try {
    const res = await fetch(CONFIG.brightData.proxyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'snapshot',
        snapshotId,
      }),
    });

    if (res.status === 202) {
      // Still processing
      return { status: 'processing', data: null };
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    lastCrawlTime = new Date();
    return { status: 'ready', data };
  } catch (err) {
    console.warn('[Bright Data] Fetch failed:', err.message);
    return { status: 'error', data: null };
  }
}


/**
 * Process raw crawl results into structured pulse data
 * Uses AI summarization via the main concierge prompt
 */
export function processCrawlResults(rawResults) {
  if (!Array.isArray(rawResults)) return [];

  return rawResults.map((result, index) => {
    const target = CRAWL_TARGETS[index] || CRAWL_TARGETS[0];
    const markdown = result?.markdown || result?.html2text || '';
    // Take first 500 chars as summary (Claude will summarize properly)
    const snippet = markdown.slice(0, 500).replace(/\n+/g, ' ').trim();

    return {
      key: target.key,
      label: target.label,
      category: target.category,
      url: target.url,
      snippet: snippet,
      timestamp: new Date().toISOString(),
      source: 'Bright Data',
    };
  });
}


/**
 * Get demo/fallback data for when API key isn't configured
 * This ensures the UI works during development and demo
 */
export function getDemoData() {
  const now = new Date();
  lastCrawlTime = now;

  return [
    {
      key: 'city_news',
      label: 'City News & Announcements',
      category: 'announcements',
      url: 'https://www.montgomeryal.gov/news',
      snippet: 'The City of Montgomery continues its investment in community infrastructure with several new projects announced this quarter. Residents are encouraged to attend upcoming town halls for updates on neighborhood improvements.',
      timestamp: now.toISOString(),
      source: 'Bright Data',
    },
    {
      key: 'city_alerts',
      label: 'City Alerts & Closures',
      category: 'safety',
      url: 'https://www.montgomeryal.gov/residents/emergency-management',
      snippet: 'The Emergency Management Agency reminds residents to stay prepared during severe weather season. Sign up for CodeRED emergency alerts to receive notifications about weather events and emergencies in your area.',
      timestamp: now.toISOString(),
      source: 'Bright Data',
    },
    {
      key: 'road_closures',
      label: 'Road Closures & Traffic',
      category: 'infrastructure',
      url: 'https://www.montgomeryal.gov/residents/street-closures',
      snippet: 'Several road improvement projects are underway across the city. Drivers should expect temporary lane closures and detours in downtown and midtown areas. Check the city website for the latest road closure map.',
      timestamp: now.toISOString(),
      source: 'Bright Data',
    },
    {
      key: 'city_events',
      label: 'Community Events',
      category: 'events',
      url: 'https://www.montgomeryal.gov/things-to-do/events',
      snippet: 'Upcoming community events include neighborhood clean-up days, farmers markets at Union Station, and cultural events at the Montgomery Museum of Fine Arts. Visit the city events calendar for full listings.',
      timestamp: now.toISOString(),
      source: 'Bright Data',
    },
  ];
}


/**
 * Main function: load Bright Data content
 * Uses live API if configured, falls back to demo data
 */
export async function loadBrightData() {
  // If demo mode or no API token, use demo data
  if (CONFIG.MODE === 'demo' || !CONFIG.brightData.apiToken) {
    console.log('[Bright Data] Using demo data');
    try {
      const res = await fetch(CONFIG.demoPaths.brightData);
      if (res.ok) {
        const data = await res.json();
        brightDataResults = data.map((d) => ({ ...d, timestamp: new Date().toISOString() }));
        lastCrawlTime = new Date();
        return brightDataResults;
      }
    } catch (e) {
      console.warn('[Bright Data] Demo file load failed, using inline fallback');
    }
    brightDataResults = getDemoData();
    return brightDataResults;
  }

  // Trigger crawl
  const snapshotId = await triggerCrawl();
  if (!snapshotId) {
    brightDataResults = getDemoData();
    return brightDataResults;
  }

  // Poll for results (max 30 seconds)
  let attempts = 0;
  while (attempts < 10) {
    await new Promise((r) => setTimeout(r, 3000));
    const result = await fetchCrawlResults(snapshotId);

    if (result.status === 'ready') {
      brightDataResults = processCrawlResults(result.data);
      return brightDataResults;
    }

    if (result.status === 'error') break;
    attempts++;
  }

  // Fallback to demo data if timeout
  console.log('[Bright Data] Crawl timed out, using demo data');
  brightDataResults = getDemoData();
  return brightDataResults;
}


/**
 * Get the last crawl time for display
 */
export function getLastCrawlTime() {
  if (!lastCrawlTime) return '—';
  return lastCrawlTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}


/**
 * Get results by category
 */
export function getByCategory(category) {
  return brightDataResults.filter((r) => r.category === category);
}


/**
 * Check if Bright Data is configured (for UI display)
 */
export function isConfigured() {
  return CONFIG.MODE !== 'demo' && !!CONFIG.brightData.apiToken;
}
