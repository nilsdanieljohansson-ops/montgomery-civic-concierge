// ════════════════════════════════════════════
// MAIN — Application entry point
// Complete version synced with current HTML
// ════════════════════════════════════════════

import { SOURCES } from './sources.js';
import { CONFIG } from './config.js';
import { arcQuery } from './arcgis.js';
import { askConcierge, fallbackRoute } from './concierge.js';
import { updatePulseCards, updateBrightDataCards, renderResult, showLoading, hideLoading } from './ui.js';
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
// HELPERS
// ────────────────────────────
function safeEl(id) {
  return $(id);
}

function setText(id, value) {
  const el = safeEl(id);
  if (el) el.textContent = value;
}

// ────────────────────────────
// LOAD CITY DATA ON STARTUP
// ────────────────────────────
async function loadCityData() {
  const find = (key) => SOURCES.find((s) => s.key === key)?.url;
  let usedDemo = false;

  if (CONFIG.MODE === 'demo') {
    await loadDemoPulse();
    usedDemo = true;
  } else {
    const [sh, si, c9, r3, pv] = await Promise.allSettled([
      arcQuery(find('tornado_shelters'), { resultRecordCount: '200' }),
      arcQuery(find('weather_sirens'), { resultRecordCount: '200' }),
      arcQuery(find('calls_911'), { resultRecordCount: '20' }),
      arcQuery(find('received_311'), { resultRecordCount: '20' }),
      arcQuery(find('paving'), { resultRecordCount: '20' }),
    ]);

    cityData.shelters = sh.status === 'fulfilled' ? sh.value : [];
    cityData.sirens = si.status === 'fulfilled' ? si.value : [];
    cityData.calls911 = c9.status === 'fulfilled' ? c9.value : [];
    cityData.requests311 = r3.status === 'fulfilled' ? r3.value : [];
    cityData.paving = pv.status === 'fulfilled' ? pv.value : [];

    const totalRecords =
      cityData.shelters.length +
      cityData.sirens.length +
      cityData.calls911.length +
      cityData.requests311.length +
      cityData.paving.length;

    if (totalRecords === 0 && CONFIG.MODE === 'auto') {
      console.warn('[Init] All ArcGIS queries returned empty — falling back to demo data');
      await loadDemoPulse();
      usedDemo = true;
    }
  }

  const dsCount = safeEl('dsCount');
  if (dsCount) dsCount.textContent = String(SOURCES.length);

  updatePulseCards(cityData);

  try {
    brightDataContent = await loadBrightData();
    updateBrightDataCards(brightDataContent, getLastCrawlTime(), isConfigured());
    console.log('[Init] Bright Data loaded:', brightDataContent.length, 'items');
  } catch (err) {
    console.warn('[Init] Bright Data load failed:', err);
  }

  console.log('[Init] City data loaded:', {
    mode: usedDemo ? 'demo' : 'live',
    shelters: cityData.shelters.length,
    sirens: cityData.sirens.length,
    calls911: cityData.calls911.length,
    requests311: cityData.requests311.length,
    paving: cityData.paving.length,
  });
}

async function loadDemoPulse() {
  try {
    const res = await fetch(CONFIG.demoPaths.pulse);
    if (!res.ok) throw new Error(`Demo pulse fetch failed: ${res.status}`);

    const demo = await res.json();

    cityData.shelters = Array(demo?.shelters?.count || 0).fill({ attributes: {} });
    cityData.sirens = Array(demo?.sirens?.count || 0).fill({ attributes: {} });
    cityData.calls911 = Array(demo?.calls911?.count || 0).fill({ attributes: {} });
    cityData.requests311 = Array(demo?.requests311?.count || 0).fill({ attributes: {} });
    cityData.paving = Array(demo?.paving?.count || 0).fill({ attributes: {} });

    console.log('[Init] Demo pulse data loaded');
  } catch (e) {
    console.warn('[Init] Demo file load failed:', e);
  }
}

// ────────────────────────────
// SUBMIT HANDLER
// ────────────────────────────
async function handleSubmit() {
  const query = safeEl('queryInput')?.value?.trim() || '';
  if (!query) return;

  const zip = safeEl('zipInput')?.value?.trim() || '';

  showLoading();

  try {
    const result = await askConcierge(query, zip, cityData);
    currentResult = result;
    renderResult(result);
  } catch (err) {
    console.error('[Submit] Error:', err);
    currentResult = fallbackRoute(query);
    renderResult(currentResult);
  } finally {
    hideLoading();
  }
}

// ────────────────────────────
// REPORT HELPERS
// ────────────────────────────
function generateReport() {
  if (!currentResult) return;

  const reportText = `Subject: ${currentResult.reportSubject}\n\n${currentResult.reportBody}`;
  const rptText = safeEl('rptText');
  const reportCard = safeEl('reportCard');

  if (rptText) rptText.textContent = reportText;
  if (reportCard) reportCard.style.display = 'block';
}

function copyReport() {
  const rptText = safeEl('rptText');
  if (!rptText) return;

  const text = rptText.textContent || '';
  if (!text.trim()) return;

  navigator.clipboard.writeText(text).then(() => {
    const btn = safeEl('copyBtn');
    if (!btn) return;

    const original = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1800);
  }).catch((err) => {
    console.error('[Copy] Clipboard failed:', err);
  });
}

// ────────────────────────────
// QUICK EXAMPLE BUTTONS
// ────────────────────────────
function setQuery(text) {
  const input = safeEl('queryInput');
  if (!input) return;

  input.value = text;
  input.focus();
}

// ────────────────────────────
// SAFETY / BADGE TOGGLES
// ────────────────────────────
function toggleBadgePanel() {
  const panel = safeEl('badgePanel');
  if (panel) panel.classList.toggle('open');
}

function toggleSafetyDetail() {
  const sfx = safeEl('sfx');
  if (sfx) sfx.classList.toggle('on');

  const panel = safeEl('badgePanel');
  if (panel) panel.classList.toggle('open');
}

// ────────────────────────────
// KEYBOARD SHORTCUTS
// ────────────────────────────
function bindKeyboard() {
  safeEl('queryInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  safeEl('zipInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
}

// ────────────────────────────
// INIT
// ────────────────────────────
function init() {
  bindKeyboard();
  loadCityData();
  runTests();
}

// ────────────────────────────
// EXPOSE TO HTML onclick handlers
// ────────────────────────────
window.handleSubmit = handleSubmit;
window.generateReport = generateReport;
window.copyReport = copyReport;
window.setQuery = setQuery;
window.toggleBadgePanel = toggleBadgePanel;
window.toggleSafetyDetail = toggleSafetyDetail;
window.toggleTester = toggleTester;
window.runTests = runTests;

init();
