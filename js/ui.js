// ════════════════════════════════════════════
// UI — DOM rendering & interaction handlers
// Updated for redesigned card-based layout
// ════════════════════════════════════════════

import { SERVICES } from './sources.js';

const $ = (id) => document.getElementById(id);

export function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function timeStamp() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ────────────────────────────
// PULSE CARDS (sidebar)
// ────────────────────────────

export function updatePulseCards(cityData) {
  const ts = timeStamp();

  $('p1').textContent = `${cityData.shelters.length} tornado shelters and ${cityData.sirens.length} weather sirens mapped`;
  $('p1t').textContent = ts;

  const c = cityData.calls911.length;
  $('p2').textContent = c > 0 ? `${c}+ recent 911 call records` : 'Connected to 911 dataset';
  $('p2t').textContent = ts;

  $('p3').textContent = cityData.paving.length > 0 ? `${cityData.paving.length} paving projects active` : 'Connected to infrastructure data';
  $('p3t').textContent = ts;

  $('p4').textContent = cityData.requests311.length > 0 ? `${cityData.requests311.length}+ recent service requests` : 'Connected to 311 data';
  $('p4t').textContent = ts;
}

// ────────────────────────────
// RESULT RENDERING
// ────────────────────────────

export function renderResult(result) {
  const svc = SERVICES[result.categoryKey] || SERVICES.council;

  // Issue header
  $('rIcon').textContent = svc.icon;
  $('rCat').textContent = result.category;
  $('rTag').textContent = svc.cat;

  // Safety badge
  const level = result.safetyLevel || 'green';
  const labels = { green: 'All Clear', yellow: 'Advisory Nearby', red: 'Active Alert' };
  $('hdrBadgeTxt').textContent = labels[level];
  $('sfxTxt').textContent = result.safetyNote || 'No active alerts.';
  $('badgePanelTxt').textContent = result.safetyNote || 'No active advisories detected.';

  // Safety card color
  const card = $('safetyCard');
  if (level === 'red') { card.style.background = '#D64045'; }
  else if (level === 'yellow') { card.style.background = '#b8860b'; }
  else { card.style.background = '#0B3C5D'; }

  // Steps — horizontal card grid
  const steps = result.steps || [];
  const stepColors = ['step-num-1', 'step-num-2', 'step-num-3'];
  const stepLabels = ['Report Issue', 'Track Status', 'Contact Info'];
  const stepBtns = [
    `<button class="step-btn step-btn-primary" onclick="generateReport()">Start Report</button>`,
    `<button class="step-btn">Track Existing</button>`,
    `<button class="step-btn">Call Now</button>`,
  ];

  $('rSteps').innerHTML = steps.map((s, i) => `
    <div class="step-card">
      <div class="step-num ${stepColors[i] || 'step-num-3'}">${i + 1}</div>
      <div class="step-title">${i < stepLabels.length ? stepLabels[i] : 'Step ' + (i+1)}</div>
      <div class="step-desc">${esc(s)}</div>
      ${i < stepBtns.length ? stepBtns[i] : ''}
    </div>
  `).join('');

  // Contact
  $('rContact').innerHTML = `
    📞 <strong>${esc(result.contactDept)}</strong> · 
    <a href="tel:${result.contactPhone}">${esc(result.contactPhone)}</a> · 
    Mon–Fri, 8AM–5PM
    ${svc.emergency ? ` · Emergency: <a href="tel:${svc.emergency}">${svc.emergency}</a>` : ''}
  `;

  // Report panel — pre-fill but show
  $('rptText').textContent = `Subject: ${result.reportSubject}\n\n${result.reportBody}`;
  $('reportCard').style.display = 'block';

  // Concierge note
  $('rNote').textContent = result.conciergeNote || 'Hope this helps — have a good day!';
  $('conciergeCard').style.display = 'flex';

  // Source chips
  const sources = result.sources || ['City of Montgomery Open Data'];
  $('rChips').innerHTML = sources.map((s) => `<span class="src-chip">${esc(s)}</span>`).join('');
  $('rChips').style.display = 'flex';

  // Show result
  $('resultArea').classList.add('on');
  $('resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ────────────────────────────
// LOADING
// ────────────────────────────

export function showLoading() {
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

const BD_ICONS = { announcements: '📢', safety: '🔴', infrastructure: '🚧', events: '🎉', government: '🏛️' };
const BD_COLORS = { announcements: 'pbar-blue', safety: 'pbar-red', infrastructure: 'pbar-warn', events: 'pbar-green', government: 'pbar-blue' };
const BD_CATS = { announcements: 'pcat-blue', safety: 'pcat-red', infrastructure: 'pcat-warn', events: 'pcat-green', government: 'pcat-blue' };

export function updateBrightDataCards(items, lastCrawlTime, configured) {
  const container = $('brightDataCards');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<div class="bd-ph">No web data loaded yet.</div>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="pulse-item">
      <div class="pbar ${BD_COLORS[item.category] || 'pbar-blue'}"></div>
      <div class="pcontent">
        <div class="pcat ${BD_CATS[item.category] || 'pcat-blue'}">${BD_ICONS[item.category] || '🌐'} ${esc(item.label)}</div>
        <div class="ptitle">${esc(item.snippet.slice(0, 120))}${item.snippet.length > 120 ? '...' : ''}</div>
        <div class="pmeta"><span>${lastCrawlTime}</span><span class="bd-source-chip"><img src="https://brightdata.com/favicon.ico" width="10" height="10" alt="" style="vertical-align:-1px;margin-right:2px">Bright Data</span></div>
      </div>
    </div>
  `).join('');

  const status = $('bdStatus');
  if (status) {
    status.className = configured ? 'bd-live' : 'bd-demo';
    status.textContent = configured ? 'Live' : 'Demo';
  }
}
