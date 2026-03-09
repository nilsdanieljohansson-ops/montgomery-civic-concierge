// ════════════════════════════════════════════
// UI — DOM rendering & interaction handlers
// Complete version synced with current HTML
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

// ────────────────────────────
// PULSE CARDS (sidebar)
// ────────────────────────────
export function updatePulseCards(cityData) {
  const ts = timeStamp();

  if ($('p1')) $('p1').textContent = `${cityData.shelters.length} tornado shelters and ${cityData.sirens.length} weather sirens mapped`;
  if ($('p1t')) $('p1t').textContent = ts;

  const calls = cityData.calls911.length;
  if ($('p2')) $('p2').textContent = calls > 0 ? `${calls}+ recent 911 call records` : 'Connected to 911 dataset';
  if ($('p2t')) $('p2t').textContent = ts;

  if ($('p3')) $('p3').textContent = cityData.paving.length > 0 ? `${cityData.paving.length} paving projects active` : 'Connected to infrastructure data';
  if ($('p3t')) $('p3t').textContent = ts;

  if ($('p4')) $('p4').textContent = cityData.requests311.length > 0 ? `${cityData.requests311.length}+ recent service requests` : 'Connected to 311 data';
  if ($('p4t')) $('p4t').textContent = ts;
}

// ────────────────────────────
// RESULT RENDERING
// ────────────────────────────
export function renderResult(result) {
  const safeResult = result || {};
  console.log('[UI] Rendering result:', safeResult);
  const key = (safeResult.categoryKey || '').toLowerCase();

  const svc =
    SERVICES[key] ||
    SERVICES.council || {
      icon: '🏛️',
      cat: safeResult.category || 'City Services',
      emergency: ''
    };

    // Issue header
  if ($('rIcon')) $('rIcon').textContent = svc.icon || '🏛️';
  if ($('rCat')) $('rCat').textContent = safeResult.category || svc.cat || 'City Services';
  if ($('rTag')) $('rTag').textContent = svc.cat !== (safeResult.category || '') ? svc.cat : 'City Service';

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
  const steps = Array.isArray(safeResult.steps) ? safeResult.steps.slice(0, 3) : [];
  const stepColors = ['step-num-1', 'step-num-2', 'step-num-3'];
  const stepLabels = ['Report Issue', 'Track Status', 'Contact Info'];
  const stepBtns = [
    `<button class="step-btn step-btn-primary" onclick="generateReport()">Start Report</button>`,
    `<button class="step-btn" type="button">Track Existing</button>`,
    `<button class="step-btn" type="button">Call Now</button>`
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
      <div class="r-contact-extra">${esc(extra)}</div>
    `;
  }

  // Report panel
  if ($('rptText')) {
    $('rptText').innerHTML = `
      <div><strong>Subject:</strong> ${esc(safeResult.reportSubject || 'City Service Request')}</div>
      <div style="margin-top:10px;">${nl2br(safeResult.reportBody || '')}</div>
    `;
  }
  if ($('reportCard')) $('reportCard').style.display = 'block';

  // Concierge note
  if ($('rNote')) {
    $('rNote').textContent = safeResult.conciergeNote || 'Hope this helps — have a good day!';
  }
  if ($('conciergeCard')) $('conciergeCard').style.display = 'flex';

  // Source chips
  const sources = Array.isArray(safeResult.sources) && safeResult.sources.length
    ? safeResult.sources
    : ['City of Montgomery Open Data'];

  if ($('rChips')) {
    $('rChips').innerHTML = sources.map((s) => `<span class="src-chip">${esc(s)}</span>`).join('');
    $('rChips').style.display = 'flex';
  }

  // Safety detail panel
  if ($('sfx')) {
    $('sfx').classList.add('on');
  }

  // Show result area
  if ($('resultArea')) {
    $('resultArea').classList.add('on');
    $('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ────────────────────────────
// LOADING
// ────────────────────────────
export function showLoading() {
  if ($('resultArea')) $('resultArea').classList.remove('on');
  if ($('loader')) $('loader').classList.add('on');
  if ($('sendBtn')) $('sendBtn').disabled = true;
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




