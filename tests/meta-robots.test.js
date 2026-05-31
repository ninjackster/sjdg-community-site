import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPage } from '../scripts/lib/build-page.js';

const shared = { common: {} };
const layout = '<html><head><meta name="robots" content="{{meta.robots}}"></head><body>{{content}}</body></html>';

function content(extraMeta = {}) {
  return { meta: { slug: { en: 'x', es: 'x' }, title: { en: 'T', es: 'T' }, description: { en: 'D', es: 'D' }, og_locale_primary: { en: 'en_US', es: 'es_MX' }, og_locale_alternate: { en: 'es_MX', es: 'en_US' }, ...extraMeta }, body: { en: 'hi', es: 'hi' } };
}

test('defaults robots to "index, follow" when meta.robots is absent', () => {
  const html = buildPage({ lang: 'en', layout, pageTemplate: '{{body}}', content: content(), shared, siteUrl: 'https://x', pageSlugs: {} });
  assert.match(html, /<meta name="robots" content="index, follow">/);
});

test('honors an explicit meta.robots value', () => {
  const html = buildPage({ lang: 'en', layout, pageTemplate: '{{body}}', content: content({ robots: { en: 'noindex, nofollow', es: 'noindex, nofollow' } }), shared, siteUrl: 'https://x', pageSlugs: {} });
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
