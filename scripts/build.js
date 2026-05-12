import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.js';
import { buildPage } from './lib/build-page.js';
import { passthrough } from './lib/passthrough.js';

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

  console.log('\nBuild complete.');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
