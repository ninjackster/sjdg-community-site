import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.js';
import { buildPage } from './lib/build-page.js';
import { passthrough } from './lib/passthrough.js';
import { renderBusinessPage } from './lib/business-page.js';
import { renderTimeline, renderHistorias, renderVoces, renderFotos } from './lib/history-render.js';
import { validateStories } from './lib/history-stories.js';
import { validateVoces, validateFotos } from './lib/history-media.js';
import { renderLocatorMap, renderDiasporaMap } from './lib/render-maps.js';
import { feature } from 'topojson-client';
import { getSnapshot } from './lib/snapshot-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const LANGS = ['en', 'es'];
const SITE_URL = 'https://sanjosedegracia.net';

async function loadShared() {
  const [nav, footer, common] = await Promise.all([
    loadContent(join(ROOT, 'content/shared/nav.json')),
    loadContent(join(ROOT, 'content/shared/footer.json')),
    loadContent(join(ROOT, 'content/shared/common.json')),
  ]);
  return { nav, footer, common };
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

// CloudDocs (iCloud) sometimes holds file handles open longer than the rm
// finishes, causing flaky EBUSY/ENOTEMPTY errors during local dev. This
// retries depth-first removal until the directory is gone. Vercel's Linux
// build doesn't need this but it's harmless there too.
function ensureRemoved(path) {
  if (!existsSync(path)) return;
  const removeRecursive = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir + '/' + entry.name;
      if (entry.isDirectory()) removeRecursive(fullPath);
      try { rmSync(fullPath, { force: true }); } catch (_) { /* keep going */ }
    }
  };
  try { removeRecursive(path); } catch (_) { /* fall through */ }
  let lastError;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { rmSync(path, { recursive: true, force: true }); return; }
    catch (err) { lastError = err; }
  }
  throw lastError;
}

function contentPath(pageName) {
  return join(ROOT, `content/pages/${pageName}.json`);
}
function templatePath(pageName) {
  return join(ROOT, `templates/pages/${pageName}.html`);
}

// home → dist/<lang>/index.html
// other → dist/<lang>/<slug>.html (slug differs per language)
function outputPath(lang, pageName, slug) {
  if (pageName === 'home') return join(DIST, lang, 'index.html');
  return join(DIST, lang, `${slug}.html`);
}

async function buildOnePage({ pageName, pageSlugs, shared, layout }) {
  const cPath = contentPath(pageName);
  const tPath = templatePath(pageName);
  if (!existsSync(cPath) || !existsSync(tPath)) {
    console.log(`⊘ skipping ${pageName} (content or template missing)`);
    return;
  }
  const content = await loadContent(cPath);
  const pageTemplate = await readFile(tPath, 'utf8');

  // The directory page needs a place_id → slug map so its card-render JS can deep-link.
  if (pageName === 'businesses') {
    const snapshot = await resolveSnapshot();
    const slugMap = {};
    if (snapshot) {
      for (const b of snapshot.businesses) slugMap[b.placeId] = b.slug;
    }
    const json = JSON.stringify(slugMap);
    content.slug_map_json = { en: json, es: json };
  }

  // History page: validate the Story atoms and pre-render the timeline + featured stories
  // into {en,es} HTML fields (the template engine has no loops).
  if (pageName === 'history') {
    const stories = await loadContent(join(ROOT, 'content/history/stories.json'));
    const v = validateStories(stories);
    if (!v.valid) throw new Error('invalid stories.json: ' + v.errors.join('; '));
    content.timeline.body = { en: renderTimeline(content.timeline, 'en'), es: renderTimeline(content.timeline, 'es') };
    content.historias = { body: { en: renderHistorias(stories, 'en'), es: renderHistorias(stories, 'es') } };
    const voces = await loadContent(join(ROOT, 'content/history/voces.json'));
    const fotos = await loadContent(join(ROOT, 'content/history/fotos.json'));
    const vv = validateVoces(voces); if (!vv.valid) throw new Error('invalid voces.json: ' + vv.errors.join('; '));
    const vf = validateFotos(fotos); if (!vf.valid) throw new Error('invalid fotos.json: ' + vf.errors.join('; '));
    content.voces = { body: { en: renderVoces(voces, 'en'), es: renderVoces(voces, 'es') } };
    content.fotos = { body: { en: renderFotos(fotos, 'en'), es: renderFotos(fotos, 'es') } };
    // Maps: build-time static SVG (d3-geo/topojson run only here, never shipped).
    const countriesTopo = JSON.parse(await readFile(join(ROOT, 'data/geo/countries-50m.json'), 'utf8'));
    const usTopo = JSON.parse(await readFile(join(ROOT, 'data/geo/us-states-10m.json'), 'utf8'));
    const countries = feature(countriesTopo, countriesTopo.objects.countries);
    const mexico = countries.features.find((f) => String(f.id) === '484');
    if (!mexico) throw new Error('Mexico feature (id 484) not found in countries-50m.json');
    const usStates = feature(usTopo, usTopo.objects.states);
    const locator = await loadContent(join(ROOT, 'content/maps/locator.json'));
    const diaspora = await loadContent(join(ROOT, 'content/maps/diaspora.json'));
    content.mapa = { body: { en: renderLocatorMap({ mexico, content: locator }, 'en'), es: renderLocatorMap({ mexico, content: locator }, 'es') } };
    content.diaspora_map = { body: { en: renderDiasporaMap({ usStates, content: diaspora }, 'en'), es: renderDiasporaMap({ usStates, content: diaspora }, 'es') } };
  }

  for (const lang of LANGS) {
    const slug = pageSlugs[pageName]?.[lang] ?? '';
    const html = buildPage({
      lang,
      layout,
      pageTemplate,
      content,
      shared,
      siteUrl: SITE_URL,
      pageSlugs,
    });
    const out = outputPath(lang, pageName, slug);
    await ensureDir(dirname(out));
    await writeFile(out, html, 'utf8');
    console.log(`✓ wrote ${out.replace(ROOT + '/', '')} (${html.length} bytes)`);
  }
}

async function main() {
  if (existsSync(DIST)) ensureRemoved(DIST);
  await ensureDir(DIST);

  await passthrough(ROOT, DIST);
  console.log('✓ copied legacy passthrough files');

  const shared = await loadShared();
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  const pageSlugs = await loadContent(join(ROOT, 'content/shared/page-slugs.json'));

  for (const pageName of Object.keys(pageSlugs)) {
    await buildOnePage({ pageName, pageSlugs, shared, layout });
  }

  await buildBusinessPages({ shared, layout, pageSlugs });

  console.log('\nBuild complete.');
}

async function resolveSnapshot() {
  const remote = await getSnapshot();
  if (remote) {
    console.log(`✓ using Upstash snapshot (${remote.count} businesses)`);
    return remote;
  }
  const localPath = join(ROOT, 'content/businesses-snapshot.json');
  if (existsSync(localPath)) {
    console.log('✓ using local snapshot fallback');
    return loadContent(localPath);
  }
  return null;
}

async function buildBusinessPages({ shared, layout, pageSlugs }) {
  const snapshot = await resolveSnapshot();
  if (!snapshot) {
    console.log('⊘ skipping per-business pages (no snapshot in Upstash or local file — run npm run fetch-businesses)');
    return;
  }
  console.log(`✓ loaded snapshot (${snapshot.count} businesses, fetched ${snapshot.fetchedAt})`);
  const detailContent = await loadContent(join(ROOT, 'content/pages/business-detail.json'));
  const template = await readFile(join(ROOT, 'templates/pages/business-detail.html'), 'utf8');

  let written = 0;
  for (const business of snapshot.businesses) {
    for (const lang of LANGS) {
      const html = renderBusinessPage({
        business,
        lang,
        layout,
        pageTemplate: template,
        detailContent,
        shared,
        pageSlugs,
        siteUrl: SITE_URL,
      });
      const dir = join(DIST, lang, lang === 'en' ? 'businesses' : 'negocios');
      await ensureDir(dir);
      await writeFile(join(dir, `${business.slug}.html`), html, 'utf8');
      written++;
    }
  }
  console.log(`✓ wrote ${written} per-business pages (${snapshot.businesses.length} businesses × 2 langs)`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
