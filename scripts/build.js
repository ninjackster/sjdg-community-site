import { mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
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

async function buildHome({ shared, layout }) {
  const content = await loadContent(join(ROOT, 'content/pages/home.json'));
  const pageTemplate = await readFile(join(ROOT, 'templates/pages/home.html'), 'utf8');

  for (const lang of LANGS) {
    const html = buildPage({
      lang,
      layout,
      pageTemplate,
      content,
      shared,
      siteUrl: SITE_URL,
    });
    const outDir = join(DIST, lang);
    await ensureDir(outDir);
    await writeFile(join(outDir, 'index.html'), html, 'utf8');
    console.log(`✓ wrote dist/${lang}/index.html (${html.length} bytes)`);
  }
}

function ensureRemoved(path) {
  if (!existsSync(path)) return;

  // First, try to remove all contents of the directory (depth-first)
  // This helps handle cases where recursive delete fails due to open handles
  const removeRecursive = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = dir + '/' + entry.name;
      if (entry.isDirectory()) {
        removeRecursive(fullPath);
      }
      try {
        rmSync(fullPath, { force: true });
      } catch (err) {
        // Ignore individual errors and keep going
      }
    }
  };

  try {
    removeRecursive(path);
  } catch (err) {
    // If recursive removal fails, just try direct removal
  }

  // Finally, try to remove the directory itself
  let lastError;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (err) {
      lastError = err;
      // Keep trying
    }
  }
  throw lastError;
}

async function main() {
  // Clean dist/
  if (existsSync(DIST)) {
    ensureRemoved(DIST);
  }
  await ensureDir(DIST);

  await passthrough(ROOT, DIST);
  console.log('✓ copied legacy passthrough files');

  const shared = await loadShared();
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');

  await buildHome({ shared, layout });

  console.log('\nBuild complete.');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
