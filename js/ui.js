// ════════════════════════════════════════════
// UI — DOM rendering & interaction handlers
// Synced with updated HTML/CSS structure
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

// ────────────────────────────
// PULSE CARDS (sidebar)
// ────────────────────────────
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

// ────────────────────────────
// RESULT RENDERING
// ────────────────────────────
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

    // Issue header
    if ($('rIcon')) $('rIcon').textContent = svc.icon || '🏛️';
    if ($('rCat')) $('rCat').textContent = safeResult.category || svc.cat || 'City Services';
    if ($('rTag')) $('rTag').textContent = svc.cat !== (safeResult.category || '') ? svc.cat : 'City Service';

    console.log('[UI] Header rendered');

    // Safety badge
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

    // Steps
    const incomingSteps = Array.isArray(safeResult.steps) ? safeResult.steps.slice(0, 3) : [];
    const fallbackSteps = [
      'Start a report with the issue details and location.',
      'Track the case or follow up with the responsible department.',
      'Use the listed contact info if you need faster help.'
    ];
    const steps = incomingSteps.length ? incomingSteps : fallbackSteps;

    const stepColors = ['step-num-1', 'step-num-2', 'step-num-3'];
    const stepLabels = ['Report Issue', 'Track Status', 'Contact Info'];
    const callPhone = safeResult.contactPhone || '311';

    const stepBtns = [
      `<button type="button" class="step-btn step-btn-primary" onclick="generateReport()">Start Report</button>`,
      `<button type="button" class="step-btn">Track Existing</button>`,
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

    // Contact
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

    // Report panel
    if ($('rptText')) {
      $('rptText').innerHTML = `
        <div><strong>Subject:</strong> ${esc(safeResult.reportSubject || 'City Service Request')}</div>
        <div style="margin-top:10px;">${nl2br(safeResult.reportBody || '')}</div>
      `;
    }
    setHidden('reportCard', false);

    // Concierge note
    if ($('rNote')) {
      $('rNote').textContent = safeResult.conciergeNote || 'Hope this helps — have a good day!';
    }
    setHidden('conciergeCard', false);

    // Source chips
    const sources = Array.isArray(safeResult.sources) && safeResult.sources.length
      ? safeResult.sources
      : ['City of Montgomery Open Data'];

    if ($('rChips')) {
      $('rChips').innerHTML = sources.map((s) => `<span class="src-chip">${esc(s)}</span>`).join('');
    }
    setHidden('rChips', false);

    console.log('[UI] Main content rendered');

    // Safety detail panel
    if ($('sfx')) {
      $('sfx').classList.add('on');
    }

    // Show result area
    if ($('resultArea')) {
      $('resultArea').classList.add('on');
      $('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    console.log('[UI] renderResult completed');
    console.log('[UI] resultArea class:', $('resultArea')?.className);
    console.log('[UI] resultArea display:', $('resultArea') ? window.getComputedStyle($('resultArea')).display : '(missing)');
    console.log('[UI] resultArea visibility:', $('resultArea') ? window.getComputedStyle($('resultArea')).visibility : '(missing)');
    console.log('[UI] resultArea opacity:', $('resultArea') ? window.getComputedStyle($('resultArea')).opacity : '(missing)');
  } catch (err) {
    console.error('[UI] renderResult crashed:', err);
  }
}

// ────────────────────────────
// LOADING
// ────────────────────────────
export function showLoading() {
  if ($('resultArea')) $('resultArea').classList.remove('on');
  if ($('loader')) $('loader').classList.add('on');
  if ($('sendBtn')) $('sendBtn').disabled = true;

  setHidden('reportCard', true);
  setHidden('conciergeCard', true);
  setHidden('rChips', true);
}

export function hideLoading() {
  if ($('loader')) $('loader').classList.remove('on');
  if ($('sendBtn')) $('sendBtn').disabled = false;
}

// ────────────────────────────
// BRIGHT DATA CARDS
// ────────────────────────────
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
