// ════════════════════════════════════════════
// UI — DOM rendering & interaction handlers
// Final synced version with shelter card support
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';

const $ = (id) => document.getElementById(id);

export function esc(str = '') {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function timeStamp() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function nl2br(str = '') {
  return esc(str).replace(/\n/g, '<br>');
}

function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.hidden = hidden;
}

function getStepLabels(result = {}) {
  const key = String(result.categoryKey || '').toLowerCase();
  const cat = String(result.category || '').toLowerCase();
  const hay = `${key} ${cat}`;

  if (/shelter|storm|weather|ema|emergency/.test(hay)) {
    return ['Find Shelter', 'Safety Updates', 'Emergency Contact'];
  }

  if (/permit|license|business/.test(hay)) {
    return ['Start Request', 'Check Status', 'Office Contact'];
  }

  if (/trash|garbage|pickup|dumping|sanitation/.test(hay)) {
    return ['Report Service Issue', 'Track Pickup', 'Sanitation Contact'];
  }

  if (/pothole|road|street|sidewalk|drain|streetlight|traffic/.test(hay)) {
    return ['Report Issue', 'Track Status', 'Public Works'];
  }

  if (/code|violation|abandoned|vehicle|property/.test(hay)) {
    return ['Submit Report', 'Follow Up', 'Department Contact'];
  }

  return ['Report Issue', 'Track Status', 'Contact Info'];
}

function buildDirectionsUrl(shelter = {}) {
  if (shelter.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shelter.address}, Montgomery, AL`)}`;
  }

  if (shelter.lat != null && shelter.lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shelter.lat},${shelter.lon}`)}`;
  }

  return '#';
}

function renderShelterRecommendation(result = {}) {
  const container = $('rShelter');
  if (!container) return;

  const shelterRecommendation = result?.shelterRecommendation;
  const primary = shelterRecommendation?.primary || null;
  const alternatives = Array.isArray(shelterRecommendation?.alternatives)
    ? shelterRecommendation.alternatives
    : [];

  if (!primary) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  const phoneHref = primary.phone
    ? `tel:${String(primary.phone).replace(/[^\d+]/g, '')}`
    : '';

  container.innerHTML = `
    <div class="shelter-card" id="shelterCard">
      <div class="shelter-kicker">Safe Shelter Option</div>
      <div class="shelter-name">${esc(primary.name || 'Tornado Shelter')}</div>

      ${primary.address ? `<div class="shelter-row">📍 ${esc(primary.address)}</div>` : ''}
      ${primary.phone ? `<div class="shelter-row">📞 ${esc(primary.phone)}</div>` : ''}
      ${primary.accessibility ? `<div class="shelter-row">♿ ${esc(primary.accessibility)}</div>` : ''}
      ${primary.capacity ? `<div class="shelter-row">👥 Capacity: ${esc(primary.capacity)}</div>` : ''}
      ${primary.notes ? `<div class="shelter-row">📝 ${esc(primary.notes)}</div>` : ''}

      <div class="shelter-why">
        Best available tornado shelter match based on your request and currently loaded Montgomery safety data.
      </div>

      <div class="shelter-actions">
        ${primary.phone ? `<a class="shelter-btn" href="${phoneHref}">📞 Call Shelter</a>` : ''}
        <a
          class="shelter-btn shelter-btn-secondary"
          href="${buildDirectionsUrl(primary)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          🧭 Open Directions
        </a>
      </div>

      ${alternatives.length ? `
        <div class="shelter-alt">
          <div class="shelter-alt-title">Other shelter options</div>
          ${alternatives.map((item) => `
            <div class="shelter-alt-item">
              <strong>${esc(item.name || 'Shelter')}</strong>
              ${item.address ? `<div>${esc(item.address)}</div>` : ''}
              ${item.accessibility ? `<div>Accessibility: ${esc(item.accessibility)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  container.hidden = false;
}

export function updatePulseCards(cityData = {}) {
  const ts = timeStamp();

  const shelters = Array.isArray(cityData.shelters) ? cityData.shelters.length : 0;
  const sirens = Array.isArray(cityData.sirens) ? cityData.sirens.length : 0;
  const calls = Array.isArray(cityData.calls911) ? cityData.calls911.length : 0;
  const paving = Array.isArray(cityData.paving) ? cityData.paving.length : 0;
  const requests311 = Array.isArray(cityData.requests311) ? cityData.requests311.length : 0;

  if ($('p1')) $('p1').textContent = `${shelters} tornado shelters and ${sirens} weather sirens mapped`;
  if ($('p1t')) $('p1t').textContent = ts;

  if ($('p2')) $('p2').textContent = calls > 0 ? `${calls}+ recent 911 call records` : 'Connected to 911 dataset';
  if ($('p2t')) $('p2t').textContent = ts;

  if ($('p3')) $('p3').textContent = paving > 0 ? `${paving} paving projects active` : 'Connected to infrastructure data';
  if ($('p3t')) $('p3t').textContent = ts;

  if ($('p4')) $('p4').textContent = requests311 > 0 ? `${requests311}+ recent service requests` : 'Connected to 311 data';
  if ($('p4t')) $('p4t').textContent = ts;
}

export function updateCityHealthScore(score = 92, meta = 'Based on city service signals and safety context') {
  if ($('cityHealthScore')) $('cityHealthScore').textContent = String(score);
  if ($('cityHealthMeta')) $('cityHealthMeta').textContent = meta;
}

function renderInsightBanner(items = []) {
  const el = $('insightBanner');
  if (!el) return;

  if (!Array.isArray(items) || !items.length) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }

  el.innerHTML = items.map((item) => {
    const tone = String(item?.tone || 'blue').toLowerCase();
    const toneClass = tone === 'red' ? 'alert-red' : tone === 'yellow' ? 'alert-yellow' : '';
    return `
      <div class="insight-card">
        <div class="insight-k">${esc(item?.label || 'Civic insight')}</div>
        <div class="insight-v ${toneClass}">${esc(item?.value || 'Ready')}</div>
      </div>
    `;
  }).join('');

  el.hidden = false;
}

export function renderResult(result) {
  const safeResult = result || {};
  console.log('[UI] Rendering result:', safeResult);

  try {
    const rawKey = safeResult.categoryKey || '';

    const svc =
      SERVICES[rawKey] ||
      SERVICES[String(rawKey).toLowerCase()] ||
      SERVICES.council || {
        icon: '🏛️',
        cat: safeResult.category || 'City Services',
        emergency: ''
      };

    if ($('rIcon')) $('rIcon').textContent = svc.icon || '🏛️';
    if ($('rCat')) $('rCat').textContent = safeResult.category || svc.cat || 'City Services';
    if ($('rTag')) $('rTag').textContent = svc.cat !== (safeResult.category || '') ? svc.cat : 'City Service';

    renderInsightBanner(safeResult.civicInsight || []);

    const level = safeResult.safetyLevel || 'green';
    const labels = {
      green: 'All Clear',
      yellow: 'Advisory Nearby',
      red: 'Active Alert'
    };

    if ($('hdrBadgeTxt')) $('hdrBadgeTxt').textContent = labels[level] || 'All Clear';
    if ($('sfxTxt')) $('sfxTxt').textContent = safeResult.safetyNote || 'No active alerts.';
    if ($('badgePanelTxt')) $('badgePanelTxt').textContent = safeResult.safetyNote || 'No active advisories detected.';

    const hdrDot = $('hdrDot');
    if (hdrDot) {
      hdrDot.textContent = level === 'red' ? '🚨' : level === 'yellow' ? '⚠️' : '✦';
    }

    const card = $('safetyCard');
    if (card) {
      if (level === 'red') card.style.background = '#D64045';
      else if (level === 'yellow') card.style.background = '#b8860b';
      else card.style.background = '#0B3C5D';
    }

    const incomingSteps = Array.isArray(safeResult.steps) ? safeResult.steps.slice(0, 3) : [];
    const fallbackSteps = [
      'Start a report with the issue details and location.',
      'Follow up with the responsible department or check an existing case.',
      'Use the listed contact method if you need direct help.'
    ];
    const steps = incomingSteps.length ? incomingSteps : fallbackSteps;

    const stepColors = ['step-num-1', 'step-num-2', 'step-num-3'];
    const stepLabels = getStepLabels(safeResult);
    const callPhone = safeResult.contactPhone || '311';

    const isShelterFlow =
      /shelter|storm|weather|ema|emergency/.test(
        `${safeResult.categoryKey || ''} ${safeResult.category || ''}`.toLowerCase()
      );

    const stepBtns = isShelterFlow
      ? [
          `<a class="step-btn step-btn-primary" href="#shelterCard">View Shelter</a>`,
          `<button type="button" class="step-btn" onclick="toggleSafetyDetail()">View Alerts</button>`,
          `<a class="step-btn" href="tel:${esc(callPhone)}">Call Now</a>`
        ]
      : [
          `<button type="button" class="step-btn step-btn-primary" onclick="generateReport()">Start Report</button>`,
          `<button type="button" class="step-btn" onclick="trackStatus()">Track Existing</button>`,
          `<a class="step-btn" href="tel:${esc(callPhone)}">Call Now</a>`
        ];

    if ($('rSteps')) {
      $('rSteps').innerHTML = steps.map((s, i) => `
        <div class="step-card">
          <div class="step-num ${stepColors[i] || 'step-num-3'}">${i + 1}</div>
          <div class="step-title">${stepLabels[i] || `Step ${i + 1}`}</div>
          <div class="step-desc">${esc(s)}</div>
          ${stepBtns[i] || ''}
        </div>
      `).join('');
    }

    renderShelterRecommendation(safeResult);

    const dept = safeResult.contactDept || 'City of Montgomery';
    const phone = safeResult.contactPhone || '311';
    const extra = safeResult.contactExtra || '';

    if ($('rContact')) {
      $('rContact').innerHTML = `
        <div class="r-contact-main">
          📞 <strong>${esc(dept)}</strong> ·
          <a href="tel:${esc(phone)}">${esc(phone)}</a>
          ${svc.emergency ? ` · Emergency: <a href="tel:${esc(svc.emergency)}">${esc(svc.emergency)}</a>` : ''}
        </div>
        ${extra ? `<div class="r-contact-extra">${esc(extra)}</div>` : ''}
      `;
    }

    if ($('rptText')) {
      $('rptText').innerHTML = `
        <div><strong>Subject:</strong> ${esc(safeResult.reportSubject || 'City Service Request')}</div>
        <div style="margin-top:10px;">${nl2br(safeResult.reportBody || '')}</div>
      `;
    }

    if ($('rNote')) {
      $('rNote').textContent = safeResult.conciergeNote || 'Hope this helps — have a good day!';
    }
    setHidden('conciergeCard', false);

    const sources = Array.isArray(safeResult.sources) && safeResult.sources.length
      ? safeResult.sources
      : ['City of Montgomery Open Data'];

    if ($('rChips')) {
      $('rChips').innerHTML = sources.map((s) => `<span class="src-chip">${esc(s)}</span>`).join('');
    }
    setHidden('rChips', false);

    if ($('sfx')) {
      $('sfx').classList.add('on');
    }

    if ($('resultArea')) {
      $('resultArea').classList.add('on');
      $('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    console.log('[UI] renderResult completed');
  } catch (err) {
    console.error('[UI] renderResult crashed:', err);
  }
}

export function showLoading() {
  if ($('resultArea')) $('resultArea').classList.remove('on');
  if ($('loader')) $('loader').classList.add('on');
  if ($('sendBtn')) $('sendBtn').disabled = true;

  setHidden('reportCard', true);
  setHidden('conciergeCard', true);
  setHidden('rChips', true);
  setHidden('rShelter', true);
  setHidden('insightBanner', true);
}

export function hideLoading() {
  if ($('loader')) $('loader').classList.remove('on');
  if ($('sendBtn')) $('sendBtn').disabled = false;
}

const BD_ICONS = {
  announcements: '📢',
  safety: '🔴',
  infrastructure: '🚧',
  events: '🎉',
  government: '🏛️'
};

const BD_COLORS = {
  announcements: 'pbar-blue',
  safety: 'pbar-red',
  infrastructure: 'pbar-warn',
  events: 'pbar-green',
  government: 'pbar-blue'
};

const BD_CATS = {
  announcements: 'pcat-blue',
  safety: 'pcat-red',
  infrastructure: 'pcat-warn',
  events: 'pcat-green',
  government: 'pcat-blue'
};

export function updateBrightDataCards(items, lastCrawlTime, configured) {
  const container = $('brightDataCards');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<div class="bd-ph">No web data loaded yet.</div>';
  } else {
    container.innerHTML = items.map((item) => `
      <div class="pulse-item">
        <div class="pbar ${BD_COLORS[item.category] || 'pbar-blue'}"></div>
        <div class="pcontent">
          <div class="pcat ${BD_CATS[item.category] || 'pcat-blue'}">
            ${BD_ICONS[item.category] || '🌐'} ${esc(item.label || 'Web signal')}
          </div>
          <div class="ptitle">
            ${esc((item.snippet || '').slice(0, 120))}${(item.snippet || '').length > 120 ? '...' : ''}
          </div>
          <div class="pmeta">
            <span>${esc(lastCrawlTime || 'Just now')}</span>
            <span class="bd-source-chip">
              <img src="https://brightdata.com/favicon.ico" width="10" height="10" alt="" style="vertical-align:-1px;margin-right:2px">
              Bright Data
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }

  const status = $('bdStatus');
  if (status) {
    status.className = configured ? 'bd-live' : 'bd-demo';
    status.textContent = configured ? 'Live' : 'Demo';
  }
}
