// ════════════════════════════════════════════
// MAIN — Application entry point
// ════════════════════════════════════════════

import { SOURCES } from './sources.js';
import { CONFIG } from './config.js';
import { arcQuery } from './arcgis.js';
import { askConcierge, fallbackRoute, getConciergeNote } from './concierge.js';
import { updatePulseCards, updateBrightDataCards, renderResult, showLoading, hideLoading, esc } from './ui.js';
import { toggleTester, runTests } from './tester.js';
import { loadBrightData, getLastCrawlTime, isConfigured } from './brightdata.js';

const $ = (id) => document.getElementById(id);

// ────────────────────────────
// STATE
// ────────────────────────────
let currentResult = null;
let brightDataContent = [];

const cityData = {
  shelters: [],
  sirens: [],
  calls911: [],
  requests311: [],
  paving: [],
};

// ────────────────────────────
// LOAD CITY DATA ON STARTUP
// ────────────────────────────
async function loadCityData() {
  const find = (key) => SOURCES.find((s) => s.key === key)?.url;

  if (CONFIG.USE_DEMO_DATA) {
    // Load from demo JSON files
    console.log('[Init] Demo mode — loading from data/ files');
    try {
      const res = await fetch(CONFIG.demoPaths.pulse);
      if (res.ok) {
        const demo = await res.json();
        cityData.shelters    = Array(demo.shelters.count).fill({ attributes: {} });
        cityData.sirens      = Array(demo.sirens.count).fill({ attributes: {} });
        cityData.calls911    = Array(demo.calls911.count).fill({ attributes: {} });
        cityData.requests311 = Array(demo.requests311.count).fill({ attributes: {} });
        cityData.paving      = Array(demo.paving.count).fill({ attributes: {} });
      }
    } catch (e) {
      console.warn('[Init] Demo file load failed:', e);
    }
  } else {
    // Live ArcGIS queries
    const [sh, si, c9, r3, pv] = await Promise.allSettled([
      arcQuery(find('tornado_shelters'), { resultRecordCount: '200' }),
      arcQuery(find('weather_sirens'),   { resultRecordCount: '200' }),
      arcQuery(find('calls_911'),        { resultRecordCount: '20' }),
      arcQuery(find('received_311'),     { resultRecordCount: '20' }),
      arcQuery(find('paving'),           { resultRecordCount: '20' }),
    ]);

    cityData.shelters    = sh.status === 'fulfilled' ? sh.value : [];
    cityData.sirens      = si.status === 'fulfilled' ? si.value : [];
    cityData.calls911    = c9.status === 'fulfilled' ? c9.value : [];
    cityData.requests311 = r3.status === 'fulfilled' ? r3.value : [];
    cityData.paving      = pv.status === 'fulfilled' ? pv.value : [];
  }

  // Update dataset count
  $('dsCount').textContent = SOURCES.length;

  // Update sidebar pulse cards (ArcGIS data)
  updatePulseCards(cityData);

  // Load Bright Data web content
  try {
    brightDataContent = await loadBrightData();
    updateBrightDataCards(brightDataContent, getLastCrawlTime(), isConfigured());
    console.log('[Init] Bright Data loaded:', brightDataContent.length, 'items');
  } catch (err) {
    console.warn('[Init] Bright Data load failed:', err);
  }

  console.log('[Init] City data loaded:', {
    shelters: cityData.shelters.length,
    sirens: cityData.sirens.length,
    calls911: cityData.calls911.length,
    requests311: cityData.requests311.length,
    paving: cityData.paving.length,
  });
}

// ────────────────────────────
// SUBMIT HANDLER
// ────────────────────────────
async function handleSubmit() {
  const query = $('queryInput').value.trim();
  if (!query) return;

  const zip = $('zipInput').value.trim();

  showLoading();

  try {
    const result = await askConcierge(query, zip, cityData);
    currentResult = result;
    renderResult(result);
  } catch (err) {
    console.error('[Submit] Error:', err);
    currentResult = fallbackRoute(query);
    renderResult(currentResult);
  }

  hideLoading();
}

// ────────────────────────────
// REPORT GENERATOR
// ────────────────────────────
function generateReport() {
  if (!currentResult) return;
  const text = `Subject: ${currentResult.reportSubject}\n\n${currentResult.reportBody}`;
  $('rptText').textContent = text;
  $('rptOut').classList.add('on');
}

function copyReport() {
  const text = $('rptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 2000);
  });
}

// ────────────────────────────
// QUICK EXAMPLE BUTTONS
// ────────────────────────────
function setQuery(text) {
  $('queryInput').value = text;
  $('queryInput').focus();
}

// ────────────────────────────
// BADGE PANEL TOGGLE
// ────────────────────────────
function toggleBadgePanel() {
  $('badgePanel').classList.toggle('open');
}

function toggleSafetyDetail() {
  $('sfx').classList.toggle('on');
}

// ────────────────────────────
// EXPOSE TO HTML onclick handlers
// ────────────────────────────
window.handleSubmit      = handleSubmit;
window.generateReport    = generateReport;
window.copyReport        = copyReport;
window.setQuery          = setQuery;
window.toggleBadgePanel  = toggleBadgePanel;
window.toggleSafetyDetail = toggleSafetyDetail;
window.toggleTester      = toggleTester;
window.runTests          = runTests;

// ────────────────────────────
// KEYBOARD SHORTCUT
// ────────────────────────────
$('queryInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSubmit();
});

// ────────────────────────────
// INIT
// ────────────────────────────
loadCityData();