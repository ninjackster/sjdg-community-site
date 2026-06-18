import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { generateSitemap } from '../scripts/lib/sitemap.js';

const PAGE_SLUGS = {
  'home':         { en: '',           es: '' },
  'businesses':   { en: 'businesses', es: 'negocios' },
  'family':       { en: 'family',     es: 'familia' },
};
const SITE = 'https://sanjosedegracia.net';

test('generateSitemap emits home and businesses but excludes private family page', () => {
  const xml = generateSitemap({
    pageSlugs: PAGE_SLUGS,
    snapshot: { businesses: [{ slug: 'taco-stand-abc123' }] },
    siteUrl: SITE,
    lastmod: '2026-06-17',
  });
  assert.match(xml, /<loc>https:\/\/sanjosedegracia\.net\/en\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/sanjosedegracia\.net\/en\/businesses<\/loc>/);
  assert.doesNotMatch(xml, /family/, 'private family page must not appear in sitemap');
  assert.doesNotMatch(xml, /familia/, 'private familia page must not appear in sitemap');
});

test('generateSitemap only emits business slugs present in the snapshot', () => {
  const xml = generateSitemap({
    pageSlugs: PAGE_SLUGS,
    snapshot: { businesses: [{ slug: 'live-one-xyz' }] },
    siteUrl: SITE,
    lastmod: '2026-06-17',
  });
  assert.match(xml, /\/en\/businesses\/live-one-xyz<\/loc>/);
  assert.match(xml, /\/es\/negocios\/live-one-xyz<\/loc>/);
  assert.doesNotMatch(xml, /removed-business/);
});

test('generateSitemap tolerates a null snapshot (no business URLs)', () => {
  const xml = generateSitemap({ pageSlugs: PAGE_SLUGS, snapshot: null, siteUrl: SITE, lastmod: '2026-06-17' });
  assert.doesNotMatch(xml, /\/businesses\/[a-z]/);
  assert.match(xml, /<loc>https:\/\/sanjosedegracia\.net\/en\/<\/loc>/);
});

test('every business URL carries en/es/x-default hreflang alternates', () => {
  const xml = generateSitemap({
    pageSlugs: PAGE_SLUGS,
    snapshot: { businesses: [{ slug: 'foo-1' }] },
    siteUrl: SITE,
    lastmod: '2026-06-17',
  });
  assert.match(xml, /hreflang="en" href="https:\/\/sanjosedegracia\.net\/en\/businesses\/foo-1"/);
  assert.match(xml, /hreflang="es" href="https:\/\/sanjosedegracia\.net\/es\/negocios\/foo-1"/);
  assert.match(xml, /hreflang="x-default" href="https:\/\/sanjosedegracia\.net\/en\/businesses\/foo-1"/);
});

// Integration: the built sitemap must never reference a business page the build didn't emit.
before(() => execSync('node scripts/build.js', { stdio: 'inherit' }));

test('built dist/sitemap.xml exists and is non-empty', () => {
  assert.ok(existsSync('dist/sitemap.xml'));
  assert.ok(readFileSync('dist/sitemap.xml', 'utf8').length > 0);
});

test('every business slug in the built sitemap has a matching built page (no 404s)', () => {
  const xml = readFileSync('dist/sitemap.xml', 'utf8');
  const slugs = [...xml.matchAll(/\/en\/businesses\/([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const slug of slugs) {
    assert.ok(existsSync(`dist/en/businesses/${slug}.html`),
      `sitemap lists /en/businesses/${slug} but dist/en/businesses/${slug}.html does not exist`);
    assert.ok(existsSync(`dist/es/negocios/${slug}.html`),
      `sitemap lists /es/negocios/${slug} but dist/es/negocios/${slug}.html does not exist`);
  }
});

test('built sitemap excludes the private family page', () => {
  const xml = readFileSync('dist/sitemap.xml', 'utf8');
  assert.doesNotMatch(xml, /\/family<\/loc>/);
  assert.doesNotMatch(xml, /\/familia<\/loc>/);
});
