import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('base.html schema no longer asserts 1,980 m or "Founded in 1793"', async () => {
  const base = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  assert.doesNotMatch(base, /1,980\s*m/i);
  assert.doesNotMatch(base, /Founded in 1793/i);
});

import { loadContent } from '../scripts/lib/content.js';

test('history content is corrected, bylined, and sourced', async () => {
  const c = await loadContent(join(ROOT, 'content/pages/history.json'));
  const json = JSON.stringify(c);
  // facts corrected
  assert.doesNotMatch(json, /Founded in 1793|Fundado en 1793|1,980/);
  assert.match(json, /1,907|1,900/);
  // byline present (both langs)
  assert.match(c.byline.en, /Compilado por Jaime Murillo/);
  assert.match(c.byline.es, /Compilado por Jaime Murillo/);
  // all 9 narrative sections present
  for (const k of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897']) {
    assert.ok(c.sections[k] && c.sections[k].h2 && c.sections[k].body, `missing section ${k}`);
  }
  // sources block present with at least 4 items rendered as HTML list
  assert.match(c.sources.body.en, /<li/);
  assert.ok((c.sources.body.en.match(/<li/g) || []).length >= 4);
  // pdf button label present
  assert.ok(c.pdf.label.en && c.pdf.label.es);
});

import { buildPage } from '../scripts/lib/build-page.js';

async function buildHistory(lang) {
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  const tpl = await readFile(join(ROOT, 'templates/pages/history.html'), 'utf8');
  const content = await loadContent(join(ROOT, 'content/pages/history.json'));
  const shared = {
    nav: await loadContent(join(ROOT, 'content/shared/nav.json')),
    footer: await loadContent(join(ROOT, 'content/shared/footer.json')),
    common: await loadContent(join(ROOT, 'content/shared/common.json')),
  };
  const pageSlugs = await loadContent(join(ROOT, 'content/shared/page-slugs.json'));
  return buildPage({ lang, layout, pageTemplate: tpl, content, shared, siteUrl: 'https://sanjosedegracia.net', pageSlugs });
}

test('history page renders long-form with print affordances and no unresolved tokens', async () => {
  const html = await buildHistory('es');
  assert.doesNotMatch(html, /\{\{.*?\}\}/);                 // no unresolved tokens
  assert.match(html, /Compilado por Jaime Murillo/);        // byline
  assert.match(html, /@media print/);                       // print stylesheet
  assert.match(html, /window\.print\(\)/);                  // download-pdf trigger
  for (const id of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897','sources']) {
    assert.match(html, new RegExp(`id="sec-${id}"`), `missing #sec-${id}`);
  }
  assert.match(html, /Descargar PDF/);                      // es pdf label
});
