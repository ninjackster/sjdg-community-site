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

import { renderHistorias } from '../scripts/lib/history-render.js';

const stories = () => ({
  heading: { en: 'Stories', es: 'Historias' },
  stories: [
    { id: 's1', kind: 'event', title: { en: 'Battle', es: 'Batalla' }, body: { en: 'In 1929…', es: 'En 1929…' } },
    { id: 's2', kind: 'person', title: { en: 'Toribio', es: 'Toribio' }, body: { en: 'Patron', es: 'Patrón' } },
  ],
});

test('renderHistorias: heading + one card per story, localized, kind chip', () => {
  const html = renderHistorias(stories(), 'es');
  assert.match(html, /Historias/);
  assert.equal((html.match(/class="cr-story"/g) || []).length, 2);
  assert.match(html, /Batalla/);
  assert.match(html, /person|event/);
});
