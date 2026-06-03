import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { feature } from 'topojson-client';
import { renderLocatorMap, renderDiasporaMap } from '../scripts/lib/render-maps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const readJSON = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));

// --- Load vendored TopoJSON + content (mirrors what Task 3's build will do) ---
const countriesTopo = readJSON('data', 'geo', 'countries-50m.json');
const countriesFC = feature(countriesTopo, countriesTopo.objects.countries);
const mexico = countriesFC.features.find((f) => String(f.id) === '484');

const statesTopo = readJSON('data', 'geo', 'us-states-10m.json');
const usStates = feature(statesTopo, statesTopo.objects.states);

const locatorContent = readJSON('content', 'maps', 'locator.json');
const diasporaContent = readJSON('content', 'maps', 'diaspora.json');

const LANGS = ['en', 'es'];

test('vendored Mexico feature (id 484) exists', () => {
  assert.ok(mexico, 'Mexico feature must be present in countries-50m.json');
});

for (const lang of LANGS) {
  test(`renderLocatorMap structure [${lang}]`, () => {
    const out = renderLocatorMap({ mexico, content: locatorContent }, lang);
    assert.match(out, /<svg/);
    assert.match(out, /<path/);
    assert.match(out, /viewBox=/);
    // town label present
    assert.ok(out.includes('San José de Gracia'), 'town label present');
    // OSM link href (HTML-escaped, so & -> &amp;) + label
    const escUrl = locatorContent.osm.url.replace(/&/g, '&amp;');
    assert.ok(out.includes('href="' + escUrl + '"'), 'OSM href present');
    assert.ok(out.includes(locatorContent.osm.label[lang]), 'OSM label present');
    // no NaN, no unresolved tokens
    assert.ok(!out.includes('NaN'), 'no NaN in output');
    assert.ok(!out.includes('{{'), 'no unresolved tokens');
  });

  test(`renderDiasporaMap structure [${lang}]`, () => {
    const out = renderDiasporaMap({ usStates, content: diasporaContent }, lang);
    assert.match(out, /<svg/);
    assert.match(out, /<path/);
    assert.match(out, /viewBox="0 0 975 610"/);
    // 4 destination labels
    for (const d of diasporaContent.destinations) {
      assert.ok(out.includes(d.label[lang]), `destination label ${d.state} present`);
    }
    // at least 4 circles (one per destination; origin adds more)
    const circles = (out.match(/<circle/g) || []).length;
    assert.ok(circles >= 4, `expected >=4 circles, got ${circles}`);
    // legend + origin label
    assert.ok(out.includes(diasporaContent.legend[lang]), 'legend present');
    assert.ok(out.includes(diasporaContent.origin.label[lang]), 'origin label present');
    // no NaN, no unresolved tokens
    assert.ok(!out.includes('NaN'), 'no NaN in output');
    assert.ok(!out.includes('{{'), 'no unresolved tokens');
  });
}

test('locator output is deterministic', () => {
  const a = renderLocatorMap({ mexico, content: locatorContent }, 'en');
  const b = renderLocatorMap({ mexico, content: locatorContent }, 'en');
  assert.equal(a, b);
});

test('diaspora output is deterministic', () => {
  const a = renderDiasporaMap({ usStates, content: diasporaContent }, 'es');
  const b = renderDiasporaMap({ usStates, content: diasporaContent }, 'es');
  assert.equal(a, b);
});

test('locator skips points with bad coordinates (no NaN)', () => {
  const bad = {
    ...locatorContent,
    points: [...locatorContent.points, { kind: 'town', lng: null, lat: undefined, label: { en: 'Bad', es: 'Mala' } }],
  };
  const out = renderLocatorMap({ mexico, content: bad }, 'en');
  assert.ok(!out.includes('NaN'));
});
