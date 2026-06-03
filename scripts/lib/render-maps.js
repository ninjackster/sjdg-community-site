// Pure build-time renderers that emit inline static SVG strings for the history
// page's two maps (a Los Altos locator + a US-diaspora map). These run ONLY in
// Node at build; nothing here (d3-geo/topojson) ships to the browser. The output
// is plain SVG markup injected as {en,es} content, like the other history
// renderers (see scripts/lib/history-render.js).
//
// Callers pass ALREADY-PARSED GeoJSON (do `topojson.feature(...)` outside this
// module). This module only imports from d3-geo. Output is deterministic: no
// Date, no Math.random.

import { geoMercator, geoPath } from 'd3-geo';

// Local escaper, matching history-render.js.
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Round to a fixed precision so coordinates are compact and deterministic, and
// so two builds produce byte-identical output.
function n(v) {
  return Math.round(v * 100) / 100;
}

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Locator map: Mexico land outline (geographic lon/lat, projected here with
 * geoMercator) plus a handful of fixed labelled points.
 *
 * @param {{ mexico: object, content: object }} args
 *   mexico  = a GeoJSON Feature or FeatureCollection (Mexico). It is both drawn
 *             and used to fit the projection.
 *   content = parsed content/maps/locator.json
 * @param {string} lang 'en' | 'es'
 * @returns {string} SVG markup wrapped in <h2>/<p>/<figure>, plus the OSM <a>.
 */
export function renderLocatorMap({ mexico, content }, lang) {
  const W = 720, H = 560;
  const heading = (content.heading && content.heading[lang]) || '';
  const intro = (content.intro && content.intro[lang]) || '';
  const titleText = heading || (lang === 'es' ? 'Mapa de ubicación' : 'Locator map');

  // Fit to a regional bounding box (so the cluster of nearby points spreads
  // across the frame) rather than to all of Mexico (which collapses them to a
  // dot). The Mexico land path is still drawn and is clipped to the viewBox.
  // content.bbox = [[west, south], [east, north]] in lon/lat.
  // Use a MultiPoint of the bbox corners to fit — a Polygon ring is subject to
  // d3-geo's spherical winding-order rule (a "wrong"-way ring is read as the
  // whole-globe complement, collapsing the scale); a MultiPoint has no such
  // ambiguity. content.bbox = [[west, south], [east, north]] in lon/lat.
  let fitTarget = mexico;
  if (Array.isArray(content.bbox) && content.bbox.length === 2) {
    const [[w, s], [e, nth]] = content.bbox;
    fitTarget = { type: 'MultiPoint', coordinates: [[w, s], [e, nth]] };
  }
  const projection = geoMercator().fitSize([W, H], fitTarget);
  const path = geoPath(projection);
  const landD = path(mexico) || '';

  const markers = (content.points || []).map((pt) => {
    if (!isFiniteNum(pt.lng) || !isFiniteNum(pt.lat)) return '';
    const xy = projection([pt.lng, pt.lat]);
    if (!xy || !isFiniteNum(xy[0]) || !isFiniteNum(xy[1])) return '';
    const x = n(xy[0]);
    const y = n(xy[1]);
    const kind = String(pt.kind || 'town');
    const label = esc((pt.label && pt.label[lang]) || '');
    // town dot largest/highlighted; historic smaller.
    const r = kind === 'town' ? 7 : kind === 'city' ? 4.5 : 3.5;
    const lblClass = kind === 'historic' ? 'cr-map-lbl cr-map-lbl-historic' : 'cr-map-lbl';
    const dot =
      '<circle class="cr-map-pt cr-map-pt-' + esc(kind) + '" cx="' + x + '" cy="' + y + '" r="' + r + '" />';
    // Per-point label placement avoids collisions where points cluster.
    // pos: 'r' (right, default) | 'l' (left) | 't' (above) | 'b' (below).
    const pos = pt.pos || 'r';
    let lx = n(x + r + 3), ly = n(y + 3), anchor = 'start';
    if (pos === 'l') { lx = n(x - r - 3); anchor = 'end'; }
    else if (pos === 't') { lx = x; ly = n(y - r - 5); anchor = 'middle'; }
    else if (pos === 'b') { lx = x; ly = n(y + r + 13); anchor = 'middle'; }
    const text = label
      ? '<text class="' + lblClass + '" x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '">' + label + '</text>'
      : '';
    return '<g class="cr-map-marker cr-map-marker-' + esc(kind) + '">' + dot + text + '</g>';
  }).join('');

  const svg =
    '<svg class="cr-map-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="' + esc(titleText) + '">' +
    '<title>' + esc(titleText) + '</title>' +
    '<path class="cr-map-land" d="' + landD + '" />' +
    markers +
    '</svg>';

  const osm = content.osm || {};
  const osmLabel = esc((osm.label && osm.label[lang]) || '');
  const osmLink = osm.url
    ? '<a class="cr-map-osm" href="' + esc(osm.url) + '" target="_blank" rel="noopener">' + osmLabel + '</a>'
    : '';

  return '<h2>' + esc(heading) + '</h2>' +
    (intro ? '<p>' + esc(intro) + '</p>' : '') +
    '<figure class="cr-map cr-map-locator">' + svg + '</figure>' +
    osmLink;
}

/**
 * Diaspora map: US states (ALREADY projected to the geoAlbersUsa 975x610 plane,
 * so geoPath uses NO projection), with the destination states tinted and
 * graduated circles + flow lines from a manually-pinned Jalisco origin.
 *
 * @param {{ usStates: object, content: object }} args
 *   usStates = GeoJSON FeatureCollection of US states (pre-projected plane).
 *   content  = parsed content/maps/diaspora.json
 * @param {string} lang 'en' | 'es'
 * @returns {string} SVG markup wrapped in <h2>/<p>/<figure>.
 */
export function renderDiasporaMap({ usStates, content }, lang) {
  const W = 975, H = 610;
  const heading = (content.heading && content.heading[lang]) || '';
  const intro = (content.intro && content.intro[lang]) || '';
  const titleText = heading || (lang === 'es' ? 'Mapa de la diáspora' : 'Diaspora map');

  // NO projection: the vendored TopoJSON is pre-projected to this 975x610 plane.
  const path = geoPath(null);

  const features = (usStates && usStates.features) || [];
  const destinations = content.destinations || [];

  // Lookup of destination state -> rank (0 = largest share) and share.
  const sorted = destinations.slice().sort((a, b) => (b.share || 0) - (a.share || 0));
  const rankByState = new Map();
  sorted.forEach((d, i) => rankByState.set(d.state, i));
  const destByState = new Map(destinations.map((d) => [d.state, d]));

  // Draw all states; destinations get an extra class + rank class for CSS tint.
  const statePaths = features.map((f) => {
    const d = path(f) || '';
    const name = (f.properties && f.properties.name) || '';
    const dest = destByState.get(name);
    let cls = 'cr-map-state';
    if (dest) {
      const rank = rankByState.get(name);
      cls += ' cr-map-state-dest cr-map-state-rank-' + rank;
    }
    return '<path class="' + cls + '" d="' + d + '" />';
  }).join('');

  // Origin marker pinned manually at lower-left (geoAlbersUsa has no Mexico).
  const ox = 70, oy = 540;
  const originLabel = esc((content.origin && content.origin.label && content.origin.label[lang]) || '');

  // For each destination: centroid (in the projected plane), flow line, circle,
  // and label. Keep deterministic ordering = content order.
  const flows = [];
  const symbols = [];
  for (const d of destinations) {
    const f = features.find((ft) => ft.properties && ft.properties.name === d.state);
    if (!f) continue;
    const c = path.centroid(f);
    if (!c || !isFiniteNum(c[0]) || !isFiniteNum(c[1])) continue;
    const cx = n(c[0]);
    const cy = n(c[1]);
    const share = isFiniteNum(d.share) ? d.share : 0;
    const r = n(4 + Math.sqrt(share) * 3); // area encodes share
    const label = esc((d.label && d.label[lang]) || '');

    flows.push('<line class="cr-map-flow" x1="' + ox + '" y1="' + oy + '" x2="' + cx + '" y2="' + cy + '" />');
    symbols.push(
      '<g class="cr-map-dest">' +
        '<circle class="cr-map-circle" cx="' + cx + '" cy="' + cy + '" r="' + r + '" />' +
        (label ? '<text class="cr-map-lbl" x="' + cx + '" y="' + n(cy - r - 4) + '" text-anchor="middle">' + label + '</text>' : '') +
      '</g>'
    );
  }

  const originMarker =
    '<g class="cr-map-origin">' +
      '<circle class="cr-map-origin-pt" cx="' + ox + '" cy="' + oy + '" r="6" />' +
      (originLabel ? '<text class="cr-map-lbl cr-map-origin-lbl" x="' + (ox + 10) + '" y="' + (oy + 4) + '">' + originLabel + '</text>' : '') +
    '</g>';

  const legendText = esc((content.legend && content.legend[lang]) || '');
  const legend = legendText
    ? '<text class="cr-map-legend" x="' + n(W / 2) + '" y="' + (H - 16) + '" text-anchor="middle">' + legendText + '</text>'
    : '';

  const svg =
    '<svg class="cr-map-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="' + esc(titleText) + '">' +
    '<title>' + esc(titleText) + '</title>' +
    statePaths +
    flows.join('') +
    originMarker +
    symbols.join('') +
    legend +
    '</svg>';

  return '<h2>' + esc(heading) + '</h2>' +
    (intro ? '<p>' + esc(intro) + '</p>' : '') +
    '<figure class="cr-map cr-map-diaspora">' + svg + '</figure>';
}
