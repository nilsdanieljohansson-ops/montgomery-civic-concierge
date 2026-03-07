// ════════════════════════════════════════════
// ARCGIS — Query helpers for Montgomery Open Data
// ════════════════════════════════════════════

/**
 * Generic ArcGIS REST query
 * @param {string} url  - Feature/MapServer layer URL (ending in /0 etc)
 * @param {object} params - Override default query params
 * @returns {Array} features array
 */
export async function arcQuery(url, params = {}) {
  const defaults = {
    where: '1=1',
    outFields: '*',
    f: 'json',
    resultRecordCount: '50',
    returnGeometry: 'true',
  };
  const q = { ...defaults, ...params };
  const qs = Object.entries(q)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const base = url.replace(/\/+$/, '');

  try {
    const res = await fetch(`${base}/query?${qs}`);
    const data = await res.json();
    return data.features || [];
  } catch (err) {
    console.warn(`[ArcGIS] Query failed: ${url}`, err);
    return [];
  }
}

/**
 * Quick sample — fetch 3 records to verify endpoint works
 * @param {string} url
 * @returns {{ ok: boolean, fields: string[], count: number }}
 */
export async function arcSample(url) {
  const feats = await arcQuery(url, { resultRecordCount: '3' });
  if (!feats.length) throw new Error('No features returned');
  const attrs = feats[0].attributes || {};
  return {
    ok: true,
    fields: Object.keys(attrs).slice(0, 6),
    count: feats.length,
  };
}