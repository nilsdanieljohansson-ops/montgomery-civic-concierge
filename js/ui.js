// ════════════════════════════════════════════
// UI — DOM rendering & interaction handlers
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';

const $ = (id) => document.getElementById(id);

/** Escape HTML to prevent XSS */
export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Current time string */
export function timeStamp() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ────────────────────────────
// PULSE CARDS
// ────────────────────────────

export function updatePulseCards(cityData) {
  const ts = timeStamp();

  // Weather & Emergency
  $('p1').textContent = `${cityData.shelters.length} tornado shelters and ${cityData.sirens.length} weather sirens mapped across Montgomery.`;
  $('p1t').textContent = `Updated: ${ts}`;

  // Public Safety (911)
  const c = cityData.calls911.length;
  $('p2').textContent = c > 0
    ? `${c}+ recent 911 call records on file. Data updated monthly by Emergency Communications.`
    : 'Connected to 911 call dataset.';
  $('p2t').textContent = `Updated: ${ts}`;

  // Infrastructure
  $('p3').textContent = cityData.paving.length > 0
    ? `${cityData.paving.length} paving projects tracked. Continuously updated by Public Works.`
    : 'Connected to paving & infrastructure data.';
  $('p3t').textContent = `Updated: ${ts}`;

  // 311 Service Requests
  $('p4').textContent = cityData.requests311.length > 0
    ? `${cityData.requests311.length}+ recent 311 requests. Covers sanitation, code violations, and resident concerns.`
    : 'Connected to 311 service request data.';
  $('p4t').textContent = `Updated: ${ts}`;
}

// ────────────────────────────
// RESULT CARD
// ────────────────────────────

export function renderResult(result) {
  const svc = SERVICES[result.categoryKey] || SERVICES.council;

  // Category header
  $('rIcon').textContent = svc.icon;
  $('rCat').textContent = result.category;

  // Safety badges (header + inline + panel)
  const level = result.safetyLevel || 'green';
  const labels = { green: 'All Clear', yellow: 'Advisory Nearby', red: 'Active Alert' };
  const dotClass = { green: 'bd-ok', yellow: 'bd-w', red: 'bd-r' };
  const badgeClass = { green: 'ok', yellow: 'w', red: 'r' };

  $('hdrDot').className = `bd ${dotClass[level]}`;
  $('hdrBadgeTxt').textContent = labels[level];

  $('rBadge').className = `ib ${badgeClass[level]}`;
  $('rBadgeTxt').textContent = labels[level];

  $('sfx').className = `sfx ${badgeClass[level]}-x`;
  $('sfxTxt').textContent = result.safetyNote || 'No active alerts.';

  $('badgePanelTxt').textContent = result.safetyNote || 'No active advisories detected.';

  // Steps
  $('rSteps').innerHTML = (result.steps || [])
    .map((s) => `<li>${esc(s)}</li>`)
    .join('');

  // Contact
  let contactHTML = `
    <div class="ct-line"><b>Department:</b> ${esc(result.contactDept)}</div>
    <div class="ct-line"><b>Phone:</b> <a href="tel:${result.contactPhone}">${esc(result.contactPhone)}</a></div>
  `;
  if (result.contactExtra) {
    contactHTML += `<div class="ct-line"><b>Info:</b> ${esc(result.contactExtra)}</div>`;
  }
  if (svc.emergency) {
    contactHTML += `<div class="ct-line"><b>Emergency:</b> <a href="tel:${svc.emergency}">${svc.emergency}</a></div>`;
  }
  $('rContact').innerHTML = contactHTML;

  // Source chips
  const sources = result.sources || ['City of Montgomery Open Data'];
  $('rChips').innerHTML = sources
    .map((s) => `<span class="chip">${esc(s)}</span>`)
    .join('');

  // Concierge note
  $('rNote').textContent = result.conciergeNote || 'Hope this helps — have a good day!';

  // Reset report
  $('rptOut').classList.remove('on');

  // Show result card
  $('resultArea').classList.add('on');
  $('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ────────────────────────────
// LOADING STATE
// ────────────────────────────

export function showLoading() {
  $('dataPills').style.display = 'none';
  $('resultArea').classList.remove('on');
  $('loader').classList.add('on');
  $('sendBtn').disabled = true;
}

export function hideLoading() {
  $('loader').classList.remove('on');
  $('sendBtn').disabled = false;
}


// ────────────────────────────
// BRIGHT DATA CARDS
// ────────────────────────────

const BD_ICONS = {
  announcements: '📢',
  safety: '🔴',
  infrastructure: '🚧',
  events: '🎉',
  government: '🏛️',
};

export function updateBrightDataCards(items, lastCrawlTime, configured) {
  const container = $('brightDataCards');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:0.5rem 0;">No web data loaded yet.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="pulse-card">
      <div class="pulse-header">
        <div class="pulse-icon bd-icon">${BD_ICONS[item.category] || '🌐'}</div>
        <div class="pulse-title">${esc(item.label)}</div>
      </div>
      <div class="pulse-body">${esc(item.snippet.slice(0, 180))}${item.snippet.length > 180 ? '...' : ''}</div>
      <div class="pulse-meta">
        <span>Updated: ${lastCrawlTime}</span>
        <span class="bd-source-chip">
          <img src="https://brightdata.com/favicon.ico" width="11" height="11" alt="" style="vertical-align:-1px;margin-right:3px">Bright Data
        </span>
      </div>
    </div>
  `).join('');

  // Update status indicator
  const status = $('bdStatus');
  if (status) {
    status.innerHTML = configured
      ? '<span class="bd-live">Live</span>'
      : '<span class="bd-demo">Demo</span>';
  }
}