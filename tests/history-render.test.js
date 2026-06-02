import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTimeline } from '../scripts/lib/history-render.js';

const timeline = () => ({
  heading: { en: 'Timeline', es: 'Línea del tiempo' },
  entries: [
    { year: '1824', label: { en: 'Tepatitlán a villa', es: 'Tepatitlán a villa' } },
    { year: '1926–29', label: { en: 'Cristero War <b>region</b>', es: 'Guerra Cristera' } },
  ],
});

test('renderTimeline: heading + entries in order, year + label', () => {
  const html = renderTimeline(timeline(), 'en');
  assert.match(html, /Timeline/);
  assert.ok(html.indexOf('1824') < html.indexOf('1926'), 'entries keep order');
  assert.match(html, /<ol class="cr-tl">/);
  assert.equal((html.match(/<li/g) || []).length, 2);
});

test('renderTimeline: localized + HTML-escaped labels', () => {
  const es = renderTimeline(timeline(), 'es');
  assert.match(es, /Guerra Cristera/);
  assert.match(es, /Línea del tiempo/);
  assert.doesNotMatch(renderTimeline(timeline(), 'en'), /<b>region<\/b>/);
  assert.match(renderTimeline(timeline(), 'en'), /&lt;b&gt;region&lt;\/b&gt;/);
});
