// ════════════════════════════════════════════
// MAIN — Application entry point
// Synced with updated HTML/CSS/UI structure
// ════════════════════════════════════════════

import { SOURCES } from './sources.js';
import { CONFIG } from './config.js';
import { arcQuery } from './arcgis.js';
import { askConcierge, fallbackRoute } from './concierge.js';
import {
  updatePulseCards,
  updateBrightDataCards,
  renderResult,
  showLoading,
  hideLoading
} from './ui.js';
import { toggleTester, runTests } from './tester.js';
import { loadBrightData, getLastCrawlTime, isConfigured } from './brightdata.js';

const $ = (id) => document.getElementById(id);

// ────────────────────────────
// STATE
// ────────────────────────────
let currentResult = null;
let brightDataContent = [];
let isSubmitting = false;

const cityData = {
  shelters: [],
  sirens: [],
  calls911: [],
  requests311: [],
  paving: []
};

// ────────────────────────────
// HELPERS
// ────────────────────────────
function safeEl(id) {
  return $(id);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstAttr(row = {}) {
  return row?.attributes || row || {};
}

function pickFields(items = [], fields = [], limit = 3) {
  return safeArray(items)
    .slice(0, limit)
    .map((item) => {
      const a = firstAttr(item);
      const obj = {};

      fields.forEach((field) => {
        if (a[field] !== undefined && a[field] !== null && String(a[field]).trim() !== '') {
          obj[field] = String(a[field]).trim();
        }
      });

      return obj;
    })
    .filter((obj) => Object.keys(obj).length > 0);
}

function setHidden(id, hidden) {
  const el = safeEl(id);
  if (el) el.hidden = hidden;
}

function buildPlainReportText(result) {
  const r = result || {};
  const subject = r.reportSubject || 'City Service Request';
  const body = r.reportBody || '';
  return `Subject: ${subject}\n\n${body}`.trim();
}

function buildLocalContext(query, zip, cityData) {
  const q = String(query || '').toLowerCase();
  const lines = [];

  const shelters = safeArray(cityData?.shelters);
  const sirens = safeArray(cityData?.sirens);
  const calls911 = safeArray(cityData?.calls911);
  const requests311 = safeArray(cityData?.requests311);
  const paving = safeArray(cityData?.paving);

  lines.push('Local Montgomery civic data context is available.');
  if (zip) lines.push(`Resident ZIP code provided: ${zip}.`);

  lines.push(
    `Loaded dataset counts: shelters=${shelters.length}, sirens=${sirens.length}, calls911=${calls911.length}, requests311=${requests311.length}, paving=${paving.length}.`
  );

  const isShelter = /tornado|storm|shelter|ema|emergency management|weather/i.test(q);
  const isRoad = /pothole|road|street|sidewalk|drain|drainage|paving|infrastructure|streetlight|traffic signal/i.test(q);
  const isTrash = /trash|garbage|pickup|dumping|litter|bulk pickup|sanitation/i.test(q);
  const isFireInfo = /fire station|fire department|fire rescue/i.test(q);
  const isEmergency = /fire in my building|building on fire|active fire|medical emergency|call 911|crime in progress/i.test(q);

  if (isShelter) {
    const shelterSamples = pickFields(
      shelters,
      ['SHELTER', 'ST_NUMBER', 'ST_NAME', 'TYPE', 'FULLADDR', 'ADDRESS'],
      3
    );
    const sirenSamples = pickFields(sirens, ['NAME', 'LOCATION', 'ADDRESS', 'TYPE'], 3);

    lines.push(`Tornado shelter records available: ${shelters.length}.`);
    if (shelterSamples.length) {
      lines.push(`Sample shelter records: ${JSON.stringify(shelterSamples)}.`);
    }

    lines.push(`Weather siren records available: ${sirens.length}.`);
    if (sirenSamples.length) {
      lines.push(`Sample siren records: ${JSON.stringify(sirenSamples)}.`);
    }

    lines.push(
      'Use this context to make shelter guidance feel local, but do not claim an exact nearest location unless the context explicitly supports it.'
    );
  }

  if (isRoad) {
    const pavingSamples = pickFields(paving, ['FULLNAME', 'StreetName', 'DistrictDesc', 'From_'], 3);
    const requestSamples = pickFields(
      requests311,
      ['Request_Type', 'Department', 'Address', 'Create_Date'],
      3
    );

    lines.push(`Paving project records available: ${paving.length}.`);
    if (pavingSamples.length) {
      lines.push(`Sample paving records: ${JSON.stringify(pavingSamples)}.`);
    }

    lines.push(`311 request records available: ${requests311.length}.`);
    if (requestSamples.length) {
      lines.push(`Sample 311 request records: ${JSON.stringify(requestSamples)}.`);
    }

    lines.push(
      'Use this context to improve routing for roads, street maintenance, drainage, streetlights, or infrastructure-related issues.'
    );
  }

  if (isTrash) {
    const requestSamples = pickFields(
      requests311,
      ['Request_Type', 'Department', 'Address', 'Create_Date'],
      3
    );

    lines.push(`311 sanitation-related routing may be supported by ${requests311.length} recent request records.`);
    if (requestSamples.length) {
      lines.push(`Sample 311 request records: ${JSON.stringify(requestSamples)}.`);
    }
  }

  if (isFireInfo) {
    const callSamples = pickFields(calls911, ['Call_Category', 'Call_Origin', 'Month', 'Year'], 3);

    lines.push(`Recent 911 call records available: ${calls911.length}.`);
    if (callSamples.length) {
      lines.push(`Sample 911 call records: ${JSON.stringify(callSamples)}.`);
    }

    lines.push(
      'If the request is only asking for a station location or department information, treat it as informational, not an active emergency.'
    );
  }

  if (isEmergency) {
    lines.push('The user language may indicate an active emergency. Prioritize safety and 911 guidance.');
  }

  if (safeArray(brightDataContent).length) {
    const relevantBright = brightDataContent
      .filter((item) => {
        const hay = `${item?.label || ''} ${item?.snippet || ''}`.toLowerCase();

        if (isShelter && /weather|storm|alert|emergency|closure/i.test(hay)) return true;
        if (isRoad && /road|closure|traffic|infrastructure|construction/i.test(hay)) return true;
        if (isTrash && /city|service|cleanup|sanitation/i.test(hay)) return true;
        if (isFireInfo && /safety|emergency|government/i.test(hay)) return true;

        return false;
      })
      .slice(0, 2)
      .map((item) => ({
        category: item?.category || '',
        label: item?.label || '',
        snippet: String(item?.snippet || '').slice(0, 180)
      }));

    if (relevantBright.length) {
      lines.push(`Relevant public web context: ${JSON.stringify(relevantBright)}.`);
    }
  }

  lines.push(
    'Use local context only to improve relevance, phrasing, and routing. Do not invent exact locations, availability, or official details unless explicitly supported.'
  );

  return lines.join('\n');
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
      arcQuery(find('paving'), { resultRecordCount: '20' })
    ]);

    cityData.shelters = sh.status === 'fulfilled' ? safeArray(sh.value) : [];
    cityData.sirens = si.status === 'fulfilled' ? safeArray(si.value) : [];
    cityData.calls911 = c9.status === 'fulfilled' ? safeArray(c9.value) : [];
    cityData.requests311 = r3.status === 'fulfilled' ? safeArray(r3.value) : [];
    cityData.paving = pv.status === 'fulfilled' ? safeArray(pv.value) : [];

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
    const bright = await loadBrightData();
    brightDataContent = safeArray(bright);
    updateBrightDataCards(brightDataContent, getLastCrawlTime(), isConfigured());
    console.log('[Init] Bright Data loaded:', brightDataContent.length, 'items');
  } catch (err) {
    brightDataContent = [];
    console.warn('[Init] Bright Data load failed:', err);
    updateBrightDataCards([], getLastCrawlTime(), isConfigured());
  }

  console.log('[Init] City data loaded:', {
    mode: usedDemo ? 'demo' : 'live',
    shelters: cityData.shelters.length,
    sirens: cityData.sirens.length,
    calls911: cityData.calls911.length,
    requests311: cityData.requests311.length,
    paving: cityData.paving.length
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
    cityData.shelters = [];
    cityData.sirens = [];
    cityData.calls911 = [];
    cityData.requests311 = [];
    cityData.paving = [];
    console.warn('[Init] Demo file load failed:', e);
  }
}

// ────────────────────────────
// SUBMIT HANDLER
// ────────────────────────────
async function handleSubmit() {
  if (isSubmitting) return;

  const query = safeEl('queryInput')?.value?.trim() || '';
  if (!query) return;

  const zip = safeEl('zipInput')?.value?.trim() || '';

  isSubmitting = true;
  showLoading();

  try {
    const localContext = buildLocalContext(query, zip, cityData);

    console.log('[Submit] Query:', query);
    console.log('[Submit] ZIP:', zip || '(none)');
    console.log('[Submit] Local context:', localContext);

    const result = await askConcierge(query, zip, cityData, localContext);
    console.log('[Submit] Concierge result:', result);

    currentResult = result || fallbackRoute(query);
    console.log('[Submit] Rendering result:', currentResult);

    renderResult(currentResult);
  } catch (err) {
    console.error('[Submit] Error:', err);
    currentResult = fallbackRoute(query);
    renderResult(currentResult);
  } finally {
    hideLoading();
    isSubmitting = false;
  }
}

// ────────────────────────────
// REPORT HELPERS
// ────────────────────────────
function generateReport() {
  if (!currentResult) return;

  const rptText = safeEl('rptText');
  if (!rptText) return;

  rptText.textContent = buildPlainReportText(currentResult);
  setHidden('reportCard', false);
}

async function copyReport() {
  const text = buildPlainReportText(currentResult);
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);

    const btn = safeEl('copyBtn');
    if (!btn) return;

    const original = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1800);
  } catch (err) {
    console.error('[Copy] Clipboard failed:', err);
  }
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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  safeEl('zipInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
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
