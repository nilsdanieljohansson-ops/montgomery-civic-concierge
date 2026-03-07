// ════════════════════════════════════════════
// TESTER — ArcGIS endpoint connectivity checker
// ════════════════════════════════════════════

import { SOURCES } from './sources.js';
import { arcQuery } from './arcgis.js';
import { esc } from './ui.js';

const $ = (id) => document.getElementById(id);

export function toggleTester() {
  $('testerPanel').classList.toggle('on');
}

export async function runTests() {
  const tbody = $('testerBody');
  tbody.innerHTML = '';

  for (const source of SOURCES) {
    // Add row with "Testing..." state
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${esc(source.label)}</td>
      <td>${source.type === 'FS' ? 'FeatureServer' : 'MapServer'}</td>
      <td><span class="t-wait">Testing...</span></td>
      <td>—</td>
    `;
    tbody.appendChild(row);

    // Test the endpoint
    try {
      const feats = await arcQuery(source.url, { resultRecordCount: '3' });

      if (!feats.length) {
        row.children[2].innerHTML = `<span class="t-warn">0 features</span>`;
        continue;
      }

      const fields = Object.keys(feats[0].attributes || {}).slice(0, 6);
      row.children[2].innerHTML = `<span class="t-ok">OK (${feats.length})</span>`;
      row.children[3].innerHTML = fields
        .map((f) => `<span class="t-field">${esc(f)}</span>`)
        .join(' ');
    } catch (err) {
      const msg = (err?.message || '').includes('fetch')
        ? 'CORS / Network error'
        : (err?.message || 'Error').slice(0, 50);
      row.children[2].innerHTML = `<span class="t-err">${esc(msg)}</span>`;
    }
  }
}