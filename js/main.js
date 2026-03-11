// ════════════════════════════════════════════
// MAIN — Application entry point
// Stable version with shelter support + Bright Data preserved
// Defensive against missing config entries
// ════════════════════════════════════════════

import { SOURCES } from './sources.js';
import { CONFIG } from './config.js';
import { arcQuery } from './arcgis.js';
import { askConcierge, fallbackRoute } from './concierge.js';
import {
  updatePulseCards,
  updateBrightDataCards,
  updateCityHealthScore,
  renderResult,
  showLoading,
  hideLoading
} from './ui.js';
import { toggleTester, runTests } from './tester.js';
import { loadBrightData, getLastCrawlTime, isConfigured } from './brightdata.js';

const $ = (id) => document.getElementById(id);

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

function safeEl(id) {
  return $(id);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstAttr(row = {}) {
  return row?.attributes || row || {};
}

function firstValue(obj = {}, keys = []) {
  for (const key of keys) {
    const val = obj?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function cleanAccessibility(value = '') {
  const v = String(value).trim();
  if (/genearl/i.test(v)) return 'GENERAL';
  return v;
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

function normalizePhone(phone = '') {
  return String(phone).replace(/[^\d+]/g, '');
}

function buildMailtoLink(result) {
  const r = result || {};
  const subject = encodeURIComponent(r.reportSubject || 'City Service Request');
  const body = encodeURIComponent(r.reportBody || '');
  return `mailto:?subject=${subject}&body=${body}`;
}

function calculateCityHealthScore(data) {
  const calls = safeArray(data.calls911).length;
  const requests = safeArray(data.requests311).length;
  const paving = safeArray(data.paving).length;
  const sirens = safeArray(data.sirens).length;
  const shelters = safeArray(data.shelters).length;

  let score = 100;
  score -= Math.min(18, calls * 0.6);
  score -= Math.min(10, requests * 0.25);
  score += Math.min(6, paving * 0.15);
  score += Math.min(4, sirens * 0.03);
  score += Math.min(4, shelters * 0.03);

  return Math.max(60, Math.min(99, Math.round(score)));
}

function updateHealthPanel() {
  const score = calculateCityHealthScore(cityData);
  updateCityHealthScore(
    score,
    `Based on ${cityData.calls911.length} recent 911 records, ${cityData.requests311.length} service requests, and ${cityData.paving.length} infrastructure projects.`
  );
}

function buildLocalContext(query, zip, cityDataObj) {
  const q = String(query || '').toLowerCase();
  const lines = [];

  const shelters = safeArray(cityDataObj?.shelters);
  const sirens = safeArray(cityDataObj?.sirens);
  const calls911 = safeArray(cityDataObj?.calls911);
  const requests311 = safeArray(cityDataObj?.requests311);
  const paving = safeArray(cityDataObj?.paving);

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

  return lines.join('\n');
}

function detectShelterNeed(query = '') {
  const q = String(query || '').toLowerCase();
  const keywords = [
    'shelter',
    'tornado',
    'storm shelter',
    'tornado shelter',
    'severe weather',
    'safe place',
    'where can i go',
    'where should i go',
    'nearest shelter',
    'weather emergency'
  ];
  return keywords.some((word) => q.includes(word));
}

function calcZipDistance(zip, shelterZip) {
  const z1 = Number(String(zip || '').trim());
  const z2 = Number(String(shelterZip || '').trim());
  if (!Number.isFinite(z1) || !Number.isFinite(z2)) return 9999;
  return Math.abs(z1 - z2);
}

function extractShelterMeta(item = {}) {
  const a = firstAttr(item);

  const streetNumber = firstValue(a, ['ST_NUMBER', 'ADDRNUM', 'HOUSE_NO']);
  const streetName = firstValue(a, ['ST_NAME', 'STREET', 'ROAD_NAME']);
  const fullAddress =
    firstValue(a, ['FULLADDR', 'ADDRESS', 'ADDRLINE1']) ||
    [streetNumber, streetName].filter(Boolean).join(' ').trim();

  return {
    name: firstValue(a, ['SHELTER', 'NAME', 'FACILITY', 'LOCATION']) || 'Tornado Shelter',
    address: fullAddress || 'Montgomery, AL',
    zip: firstValue(a, ['ZIP', 'ZIPCODE', 'POSTAL']),
    accessibility: cleanAccessibility(firstValue(a, ['ACCESSIBILITY', 'ACCESS', 'ADA'])),
    capacity: firstValue(a, ['CAPACITY', 'OCCUPANCY']),
    phone: firstValue(a, ['PHONE', 'CONTACT', 'PHONE_NUMBER']),
    notes: firstValue(a, ['NOTES', 'COMMENT', 'COMMENTS']),
    lat: a?.Latitude ?? a?.LATITUDE ?? a?.Y ?? a?.y ?? null,
    lon: a?.Longitude ?? a?.LONGITUDE ?? a?.X ?? a?.x ?? null
  };
}

function scoreShelter(item, zip = '') {
  const meta = extractShelterMeta(item);
  let score = 0;

  if (zip && meta.zip) score -= calcZipDistance(zip, meta.zip);
  if (meta.accessibility && /ada|accessible|general/i.test(meta.accessibility)) score += 5;
  if (meta.capacity) score += 1;
  if (meta.phone) score += 1;
  if (meta.address) score += 2;

  return { score, meta };
}

function buildShelterRecommendation(shelters = [], zip = '') {
  const scored = safeArray(shelters)
    .map((item) => scoreShelter(item, zip))
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  return {
    primary: scored[0]?.meta || null,
    alternatives: scored.slice(1, 3).map((x) => x.meta)
  };
}

async function resolveShelterRecommendation(query, zip = '') {
  if (!detectShelterNeed(query)) {
    return { recommendation: null, zip };
  }

  const recommendation = buildShelterRecommendation(cityData.shelters, zip);
  return { recommendation, zip };
}

function enrichResultWithShelter(result, shelterPack, query) {
  const safe = { ...(result || {}) };

  if (!detectShelterNeed(query)) return safe;

  const reco = shelterPack?.recommendation || null;
  if (reco?.primary) {
    safe.shelterRecommendation = reco;
    safe.category = 'Emergency Shelter';
    safe.categoryKey = 'shelter';
    safe.contactDept = 'Alabama Emergency Management Agency';
    safe.contactPhone = safe.contactPhone || '911';
    safe.contactExtra = 'For immediate danger call 911. For official statewide emergency updates, contact Alabama EMA.';
    safe.reportSubject = safe.reportSubject || 'Emergency Shelter Information Request';
    safe.reportBody =
      safe.reportBody ||
      `I need tornado shelter information for Montgomery${shelterPack?.zip ? ` ZIP ${shelterPack.zip}` : ''}. Please confirm the best available shelter option and any current emergency instructions.`;
    safe.conciergeNote =
      safe.conciergeNote ||
      'I found a shelter option using the currently loaded Montgomery safety data. Please verify official emergency instructions if severe weather is active.';

    if (!Array.isArray(safe.steps) || !safe.steps.length) {
      const shelterName = reco.primary.name || 'the recommended shelter';
      safe.steps = [
        `Review ${shelterName} and confirm the address before traveling.`,
        'Use Open Directions or call the shelter for access instructions.',
        'If severe weather is active or conditions are dangerous, call 911 immediately.'
      ];
    }

    if (!safe.safetyLevel || safe.safetyLevel === 'green') {
      safe.safetyLevel = 'yellow';
    }
    if (!safe.safetyNote || /no active alerts/i.test(safe.safetyNote)) {
      safe.safetyNote = 'Shelter guidance is available. In an active severe weather emergency, rely on official alerts and call 911 if needed.';
    }
  }

  return safe;
}

function updateSafetyBadgeDemo() {
  const badgePanel = safeEl('badgePanelTxt');
  if (badgePanel && !badgePanel.textContent.trim()) {
    badgePanel.textContent = 'No active advisories detected.';
  }

  const hdrBadge = safeEl('hdrBadgeTxt');
  if (hdrBadge && !hdrBadge.textContent.trim()) {
    hdrBadge.textContent = 'All Clear';
  }

  const safetyCard = safeEl('safetyCard');
  if (safetyCard && !safetyCard.style.background) {
    safetyCard.style.background = '#0B3C5D';
  }
}

function getArcConfig(name) {
  const arcgis = CONFIG?.arcgis || {};
  return arcgis?.[name] && arcgis[name].url ? arcgis[name] : null;
}

async function queryArcSource(name) {
  const source = getArcConfig(name);
  if (!source) {
    console.warn(`[Init] Missing ArcGIS config for "${name}"`);
    return [];
  }

  try {
    const rows = await arcQuery(source.url, source.params || {});
    return safeArray(rows);
  } catch (err) {
    console.warn(`[Init] ArcGIS query failed for "${name}":`, err);
    return [];
  }
}

async function loadCityData() {
  let usedDemo = false;

  if (CONFIG.MODE === 'demo') {
    await loadDemoPulse();
    usedDemo = true;
  } else {
    cityData.shelters = await queryArcSource('shelters');
    cityData.sirens = await queryArcSource('sirens');
    cityData.calls911 = await queryArcSource('calls911');
    cityData.requests311 = await queryArcSource('requests311');
    cityData.paving = await queryArcSource('paving');

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
  updateHealthPanel();
  updateSafetyBadgeDemo();

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

    const shelterPack = await resolveShelterRecommendation(query, zip);
    currentResult = enrichResultWithShelter(result || fallbackRoute(query), shelterPack, query);

    console.log('[Submit] Rendering result:', currentResult);
    renderResult(currentResult);
  } catch (err) {
    console.error('[Submit] Error:', err);
    const shelterPack = await resolveShelterRecommendation(query, zip);
    currentResult = enrichResultWithShelter(fallbackRoute(query), shelterPack, query);
    renderResult(currentResult);
  } finally {
    hideLoading();
    isSubmitting = false;
  }
}

function generateReport() {
  const card = safeEl('reportCard');
  if (!card) return;

  setHidden('reportCard', false);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function viewShelter() {
  const shelterContainer = safeEl('rShelter');
  const shelterCard = safeEl('shelterCard');

  if (shelterContainer) {
    shelterContainer.hidden = false;
  }

  if (shelterCard) {
    shelterCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const resultArea = safeEl('resultArea');
  if (resultArea) {
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function trackStatus() {
  if (!currentResult) return;

  const trackUrl = String(currentResult.trackUrl || '').trim();
  const phone = String(currentResult.contactPhone || '').trim();
  const dept = String(currentResult.contactDept || 'the city department').trim();

  if (trackUrl) {
    window.open(trackUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    const shouldCall = window.confirm(
      `To track an existing case, contact ${dept} at ${phone}. Press OK to call.`
    );

    if (shouldCall && normalized) {
      window.location.href = `tel:${normalized}`;
    }
    return;
  }

  window.alert(`To track an existing case, please contact ${dept}.`);
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

function openReportEmail() {
  if (!currentResult) return;
  window.location.href = buildMailtoLink(currentResult);
}

function setQuery(text) {
  const input = safeEl('queryInput');
  if (!input) return;

  input.value = text;
  input.focus();
}

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

function init() {
  bindKeyboard();
  loadCityData();
  runTests();
}

window.handleSubmit = handleSubmit;
window.generateReport = generateReport;
window.viewShelter = viewShelter;
window.trackStatus = trackStatus;
window.copyReport = copyReport;
window.openReportEmail = openReportEmail;
window.setQuery = setQuery;
window.toggleBadgePanel = toggleBadgePanel;
window.toggleSafetyDetail = toggleSafetyDetail;
window.toggleTester = toggleTester;
window.runTests = runTests;

init();
