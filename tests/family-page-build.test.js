import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPage } from '../scripts/lib/build-page.js';
import { loadContent } from '../scripts/lib/content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('family page builds with noindex and login shell, no unresolved tokens', async () => {
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  const tpl = await readFile(join(ROOT, 'templates/pages/family.html'), 'utf8');
  const content = await loadContent(join(ROOT, 'content/pages/family.json'));
  const shared = {
    nav: await loadContent(join(ROOT, 'content/shared/nav.json')),
    footer: await loadContent(join(ROOT, 'content/shared/footer.json')),
    common: await loadContent(join(ROOT, 'content/shared/common.json')),
  };
  const pageSlugs = await loadContent(join(ROOT, 'content/shared/page-slugs.json'));
  const html = buildPage({ lang: 'es', layout, pageTemplate: tpl, content, shared, siteUrl: 'https://sanjosedegracia.net', pageSlugs });
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /id="ft-login"/);
  assert.match(html, /id="ft-canvas"/);
  assert.match(html, /family-tree\.js/);
  assert.doesNotMatch(html, /\{\{.*?\}\}/);
});
