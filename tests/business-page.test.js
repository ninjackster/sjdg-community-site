import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderBusinessPage } from '../scripts/lib/business-page.js';
import { loadContent } from '../scripts/lib/content.js';

const FIXTURE = JSON.parse(readFileSync('tests/fixtures/business-fixture.json', 'utf8'));

const LAYOUT = `<!DOCTYPE html><html lang="{{lang}}"><head><title>{{meta.title}}</title>{{hreflang}}</head><body>{{content}}</body></html>`;

async function setup() {
  const detailContent = await loadContent('content/pages/business-detail.json');
  const template = readFileSync('templates/pages/business-detail.html', 'utf8');
  const shared = {
    nav: await loadContent('content/shared/nav.json'),
    footer: await loadContent('content/shared/footer.json'),
    common: await loadContent('content/shared/common.json'),
  };
  const pageSlugs = await loadContent('content/shared/page-slugs.json');
  return { detailContent, template, shared, pageSlugs };
}

test('renders an English page with the business name in <h1>', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const html = renderBusinessPage({
    business: FIXTURE,
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: template,
    detailContent,
    shared,
    pageSlugs,
    siteUrl: 'https://sanjosedegracia.net',
  });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h1[^>]*>Cantina La Soga<\/h1>/);
  assert.match(html, /Independencia 90/);
});

test('renders a Spanish page with Spanish chrome', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const html = renderBusinessPage({
    business: FIXTURE,
    lang: 'es',
    layout: LAYOUT,
    pageTemplate: template,
    detailContent,
    shared,
    pageSlugs,
    siteUrl: 'https://sanjosedegracia.net',
  });
  assert.match(html, /<html lang="es-MX">/);
  assert.match(html, /Volver al directorio/);
  assert.match(html, /Dirección/);
  assert.match(html, /Horario/);
});

test('emits LocalBusiness JSON-LD with correct fields', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const html = renderBusinessPage({
    business: FIXTURE,
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: template,
    detailContent,
    shared,
    pageSlugs,
    siteUrl: 'https://sanjosedegracia.net',
  });
  const m = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/);
  assert.ok(m, 'expected JSON-LD script block');
  const schema = JSON.parse(m[1]);
  assert.equal(schema['@type'], 'LocalBusiness');
  assert.equal(schema.name, 'Cantina La Soga');
  assert.equal(schema.telephone, '+52 376 735 1234');
  assert.equal(schema.address['@type'], 'PostalAddress');
  assert.equal(schema.address.addressLocality, 'San José de Gracia');
  assert.equal(schema.address.addressRegion, 'Jalisco');
  assert.equal(schema.address.addressCountry, 'MX');
  assert.equal(schema.geo['@type'], 'GeoCoordinates');
  assert.equal(schema.geo.latitude, 20.6758);
  assert.equal(schema.geo.longitude, -102.5721);
  assert.equal(schema.aggregateRating.ratingValue, 4.6);
  assert.equal(schema.aggregateRating.reviewCount, 87);
  assert.ok(Array.isArray(schema.openingHoursSpecification));
  assert.ok(schema.openingHoursSpecification.length >= 1);
});

test('hreflang points EN ↔ ES per-business URLs', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const html = renderBusinessPage({
    business: FIXTURE,
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: template,
    detailContent,
    shared,
    pageSlugs,
    siteUrl: 'https://sanjosedegracia.net',
  });
  assert.match(html, /hreflang="en" href="https:\/\/sanjosedegracia\.net\/en\/businesses\/cantina-la-soga-2alm8c"/);
  assert.match(html, /hreflang="es" href="https:\/\/sanjosedegracia\.net\/es\/negocios\/cantina-la-soga-2alm8c"/);
});

test('hours table renders one row per weekday with day name in current language', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const htmlEn = renderBusinessPage({ business: FIXTURE, lang: 'en', layout: LAYOUT, pageTemplate: template, detailContent, shared, pageSlugs, siteUrl: 'https://sanjosedegracia.net' });
  const htmlEs = renderBusinessPage({ business: FIXTURE, lang: 'es', layout: LAYOUT, pageTemplate: template, detailContent, shared, pageSlugs, siteUrl: 'https://sanjosedegracia.net' });
  assert.match(htmlEn, /<dt>Tuesday<\/dt>/);
  assert.match(htmlEs, /<dt>Martes<\/dt>/);
});

test('businesses with no phone show the localized "no phone" label', async () => {
  const { detailContent, template, shared, pageSlugs } = await setup();
  const noPhone = { ...FIXTURE, internationalPhoneNumber: undefined };
  const htmlEn = renderBusinessPage({ business: noPhone, lang: 'en', layout: LAYOUT, pageTemplate: template, detailContent, shared, pageSlugs, siteUrl: 'https://sanjosedegracia.net' });
  assert.match(htmlEn, /No phone listed/);
});
