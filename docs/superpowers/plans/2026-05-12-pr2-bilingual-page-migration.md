# PR 2 — Bilingual Page Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `businesses`, `faq`, `tour`, `advertise` from legacy single-language HTML to the bilingual build system. Ship them at `/en/<slug>` and `/es/<slug>` with translated Spanish slugs (`negocios`, `preguntas`, `recorrido`, `anuncios`). 301-redirect the old URLs to the English versions.

**Architecture:** Reuses PR 1's build system. Adds a shared `page-slugs.json` registry and a `nav_urls` context variable so nav links automatically use the right language path. Each page becomes one content JSON + one template, both rendered per language by the existing `buildPage()`. Legacy HTML files are deleted from the repo; Vercel `redirects` in `vercel.json` keep old URLs working.

**Tech Stack:** Same as PR 1 — Node 20+, vanilla JS, no runtime deps. Vercel for hosting and redirects.

**Project root:** `/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage`

**Spec reference:** `docs/superpowers/specs/2026-05-12-seo-overhaul-design.md` (see PR 2 row in the PR sequence table)

**Out of scope for PR 2:**
- Per-business static pages (PR 4)
- `/` root-language redirect (PR 3)
- hreflang on legacy pages (PR 3, but irrelevant here since legacy pages are deleted)
- `.org` domain redirect (PR 6)

---

## Locked design decisions (from brainstorming)

1. **Spanish slugs:** `businesses → negocios`, `faq → preguntas`, `tour → recorrido`, `advertise → anuncios`
2. **Legacy redirects:** All four old paths 301 to the English version (e.g. `/businesses → /en/businesses`). Language-aware redirect deferred to PR 3 along with the `/` root redirect.
3. **Businesses page:** Templatize the shell only — keep the existing client-side Google Places API fetch for listings. Per-business static pages come in PR 4.
4. **Admin page:** `admin-businesses.html` stays English-only at `/admin-businesses` via passthrough. Internal tool, not user-facing.

---

## File Structure

**New files:**

| Path | Responsibility |
|------|---------------|
| `content/shared/page-slugs.json` | Registry of every page's slug per language. Drives nav URLs and the build runner's iteration. |
| `content/pages/businesses.json` | Translatable strings for the businesses page (chrome only — listings are dynamic) |
| `content/pages/faq.json` | All FAQ Q&A and meta strings |
| `content/pages/tour.json` | Walking tour stops, intro, meta |
| `content/pages/advertise.json` | Pricing tiers, copy, meta |
| `templates/pages/businesses.html` | Page template — directory shell with tabs, search, places-grid, includes the existing Maps Places JS |
| `templates/pages/faq.html` | FAQ accordion structure with token-substituted Q&A |
| `templates/pages/tour.html` | Walking tour template (Leaflet map block + stops list) |
| `templates/pages/advertise.html` | Pricing tiers, contact CTA |

**Modified files:**

| Path | Change |
|------|--------|
| `scripts/lib/build-page.js` | Add `nav_urls` to render context, computed from page-slugs registry |
| `tests/build-page.test.js` | Add tests for nav_urls |
| `scripts/build.js` | Iterate every page in `page-slugs.json` instead of hardcoding home |
| `tests/build.test.js` | Add tests asserting all 5 pages exist for each language with correct slugs |
| `templates/layouts/base.html` | Replace nav `href="/businesses"` etc. with `href="{{nav_urls.businesses}}"` etc. |
| `vercel.json` | Add `redirects` block — 4 permanent redirects from legacy URLs to `/en/<slug>` |
| `sitemap.xml` | Add `/{en,es}/<slug>` entries (10 new URLs) and remove obsolete legacy entries |

**Deleted files** (after redirects in place):

| Path | Reason |
|------|--------|
| `businesses.html` | Replaced by `/en/businesses` and `/es/negocios` |
| `faq.html` | Replaced by `/en/faq` and `/es/preguntas` |
| `tour.html` | Replaced by `/en/tour` and `/es/recorrido` |
| `advertise.html` | Replaced by `/en/advertise` and `/es/anuncios` |

**Untouched:** `index.html` (legacy homepage stays at `/` for now — PR 3 will redirect `/` based on Accept-Language). `admin-businesses.html`. `api/`. All images, fonts, robots.txt, favicons.

---

## Pre-flight: Worktree setup (controller responsibility, not a task)

Before dispatching subagents, create a worktree:

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree add .worktrees/pr2-bilingual-pages -b feat/pr2-bilingual-pages
cd .worktrees/pr2-bilingual-pages
npm test    # verify baseline — should be 27 passing
```

If baseline fails, stop and investigate before proceeding.

All task work below happens inside the worktree.

---

## Task 1: Page-slugs registry

Adds the registry that maps logical page names to per-language slugs. Used by both the build runner (to iterate pages) and the page builder (to compute `nav_urls`).

**Files:**
- Create: `content/shared/page-slugs.json`

- [ ] **Step 1: Create the file**

```json
{
  "home":       { "en": "",            "es": "" },
  "businesses": { "en": "businesses",  "es": "negocios" },
  "faq":        { "en": "faq",         "es": "preguntas" },
  "tour":       { "en": "tour",        "es": "recorrido" },
  "advertise":  { "en": "advertise",   "es": "anuncios" }
}
```

- [ ] **Step 2: Sanity-check parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('content/shared/page-slugs.json'))" && echo ok`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add content/shared/page-slugs.json
git commit -m "feat: add page-slugs registry for bilingual URL routing"
```

---

## Task 2: Inject `nav_urls` into render context (TDD)

Extends `buildPage()` to accept an optional `pageSlugs` argument (the registry from Task 1) and exposes `nav_urls.<page>` as a context variable. Each value is the absolute URL for that page in the CURRENT language.

**Files:**
- Modify: `scripts/lib/build-page.js`
- Modify: `tests/build-page.test.js`

- [ ] **Step 1: Add new failing tests to `tests/build-page.test.js`**

Append these tests at the end of the file (after the existing 6):

```javascript
const PAGE_SLUGS = {
  home:       { en: '',            es: '' },
  businesses: { en: 'businesses',  es: 'negocios' },
  faq:        { en: 'faq',         es: 'preguntas' },
};

test('exposes nav_urls for the current language', () => {
  const html = buildPage({
    lang: 'en',
    layout: '<a href="{{nav_urls.businesses}}">B</a><a href="{{nav_urls.faq}}">F</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/en\/businesses">B<\/a>/);
  assert.match(html, /<a href="\/en\/faq">F<\/a>/);
});

test('nav_urls swaps to Spanish slugs when lang is es', () => {
  const html = buildPage({
    lang: 'es',
    layout: '<a href="{{nav_urls.businesses}}">B</a><a href="{{nav_urls.faq}}">F</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/es\/negocios">B<\/a>/);
  assert.match(html, /<a href="\/es\/preguntas">F<\/a>/);
});

test('nav_urls.home points at the language root', () => {
  const html = buildPage({
    lang: 'es',
    layout: '<a href="{{nav_urls.home}}">H</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/es\/">H<\/a>/);
});

test('buildPage works without pageSlugs (backwards compat — nav_urls is empty object)', () => {
  // No pageSlugs passed — nav_urls should be an empty object so missing tokens still throw
  const html = buildPage({
    lang: 'en',
    layout: '<p>{{meta.title}}</p>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<p>EN Title<\/p>/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 4 new tests fail (existing 27 still pass).

- [ ] **Step 3: Update `scripts/lib/build-page.js`**

Replace the entire file with:

```javascript
import { render } from './render.js';
import { resolveLang } from './content.js';

const LANGS = ['en', 'es'];
const HTML_LANG = { en: 'en', es: 'es-MX' };
const DEFAULT_LANG = 'en';

function urlFor(siteUrl, lang, slug) {
  return slug ? `${siteUrl}/${lang}/${slug}` : `${siteUrl}/${lang}/`;
}

function pathFor(lang, slug) {
  return slug ? `/${lang}/${slug}` : `/${lang}/`;
}

function buildHreflang(siteUrl, slugs) {
  const tags = LANGS.map(
    l => `<link rel="alternate" hreflang="${l}" href="${urlFor(siteUrl, l, slugs[l])}" />`
  );
  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${urlFor(siteUrl, DEFAULT_LANG, slugs[DEFAULT_LANG])}" />`
  );
  return tags.join('\n');
}

function buildNavUrls(lang, pageSlugs) {
  const out = {};
  if (!pageSlugs) return out;
  for (const [pageName, slugMap] of Object.entries(pageSlugs)) {
    const slug = slugMap[lang] ?? '';
    out[pageName] = pathFor(lang, slug);
  }
  return out;
}

export function buildPage({ lang, layout, pageTemplate, content, shared, siteUrl, pageSlugs }) {
  const localized = resolveLang(content, lang);
  const localizedShared = resolveLang(shared, lang);

  const slugs = {};
  for (const l of LANGS) slugs[l] = content.meta.slug[l] ?? '';

  const ctx = {
    ...localized,
    shared: localizedShared,
    lang: HTML_LANG[lang],
    canonical: urlFor(siteUrl, lang, slugs[lang]),
    hreflang: buildHreflang(siteUrl, slugs),
    nav_urls: buildNavUrls(lang, pageSlugs),
  };

  // Render the page body first, then inject it into the layout.
  const body = render(pageTemplate, ctx);
  return render(layout, { ...ctx, content: body });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 31 tests pass (27 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/build-page.js tests/build-page.test.js
git commit -m "feat: expose nav_urls in render context for bilingual nav links"
```

---

## Task 3: Update base layout nav to use `nav_urls`

Switches the hardcoded nav hrefs in `templates/layouts/base.html` to language-aware tokens. After this, the homepage will already link to the right Spanish slugs (even before the new pages exist — they'll 404 until later tasks land them).

**Files:**
- Modify: `templates/layouts/base.html`

- [ ] **Step 1: Inspect current nav in `templates/layouts/base.html`**

Open the file and find every nav `<a>` tag. There are typically TWO occurrences each (desktop nav + mobile menu). Look for hrefs like:
- `href="/{{lang}}/"` (or similar) for the home logo
- `href="/businesses"` for directory
- `href="/faq"` for FAQ
- (no nav link to `/tour` or `/advertise` unless they exist — check)

Also note the mobile-menu duplicates.

- [ ] **Step 2: Replace each legacy href with the matching nav_urls token**

Make these replacements in `templates/layouts/base.html` (use `Edit` tool with full surrounding context to ensure unique matches — there are usually two of each, one for desktop nav, one for mobile):

| Find | Replace |
|------|---------|
| `href="/businesses"` | `href="{{nav_urls.businesses}}"` |
| `href="/faq"` | `href="{{nav_urls.faq}}"` |
| `href="/tour"` | `href="{{nav_urls.tour}}"` |
| `href="/advertise"` | `href="{{nav_urls.advertise}}"` |

The home-logo link should already use `/{{lang}}/` form from PR 1; if not, change it to `href="{{nav_urls.home}}"`.

If the file has TWO occurrences of each (desktop + mobile), use `replace_all: true` on the Edit, OR do two separate edits with surrounding context.

ALSO: the language switcher pair (`<a href="/en/">EN</a>` and `<a href="/es/">ES</a>`) — leave those as-is. They intentionally point to absolute language roots regardless of nav_urls.

- [ ] **Step 3: Verify with a sanity build**

Run from worktree:
```bash
node --input-type=module -e "
import { loadContent } from './scripts/lib/content.js';
import { buildPage } from './scripts/lib/build-page.js';
import { readFile } from 'node:fs/promises';

const layout = await readFile('templates/layouts/base.html', 'utf8');
const page = await readFile('templates/pages/home.html', 'utf8');
const content = await loadContent('content/pages/home.json');
const shared = {
  nav: await loadContent('content/shared/nav.json'),
  footer: await loadContent('content/shared/footer.json'),
  common: await loadContent('content/shared/common.json'),
};
const pageSlugs = await loadContent('content/shared/page-slugs.json');
for (const lang of ['en', 'es']) {
  const html = buildPage({ lang, layout, pageTemplate: page, content, shared, siteUrl: 'https://sanjosedegracia.net', pageSlugs });
  const navMatches = [...html.matchAll(/<a href=\"(\\/[a-z]{2}\\/[a-z]*)\"[^>]*>(?:Directory|Directorio|FAQ|Preguntas)/g)];
  console.log(lang, 'nav matches:', navMatches.map(m => m[1]).slice(0, 4));
}
" 2>&1 | tail -10
```

Expected output:
```
en nav matches: [ '/en/businesses', '/en/faq' ]
es nav matches: [ '/es/negocios', '/es/preguntas' ]
```

If you see `/businesses` (no language prefix) anywhere, you missed a nav link.

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All 31 tests still pass. (Plus the existing build.test.js will run the build with the new layout — should still produce both homepages correctly.)

If build tests fail with `unresolved token: nav_urls.businesses`, that means `scripts/build.js` doesn't pass `pageSlugs` yet. That's expected — it'll be fixed in Task 4. To unblock the test suite for now, you can pass `pageSlugs` from `scripts/build.js` already (preview Task 4's change). Otherwise, just verify build-page tests still pass and proceed; Task 4 will rewire the runner.

Concretely, if `npm test` fails on `build.test.js` here:
- Either temporarily skip those tests by using `test.skip(...)` (and re-enable in Task 4), OR
- Move on to Task 4 immediately to fix the runner. Recommended: do Task 4 right away.

- [ ] **Step 5: Commit**

```bash
git add templates/layouts/base.html
git commit -m "refactor: nav links use language-aware nav_urls tokens"
```

---

## Task 4: Build runner iterates pages from registry

Replace the hardcoded homepage build in `scripts/build.js` with a generic loop that builds every page in `page-slugs.json`. For PR 2 only `home` will exist with content+template; the others get added in Task 5+.

**Files:**
- Modify: `scripts/build.js`
- Modify: `tests/build.test.js`

- [ ] **Step 1: Add new failing tests to `tests/build.test.js`**

Append at the bottom of the file:

```javascript
test('build creates dist/en/businesses.html when content + template exist', () => {
  if (!existsSync('content/pages/businesses.json')) return;  // skip if Task 5 not done yet
  assert.ok(existsSync('dist/en/businesses.html'), 'dist/en/businesses.html should exist');
});

test('build creates dist/es/negocios.html when content + template exist', () => {
  if (!existsSync('content/pages/businesses.json')) return;
  assert.ok(existsSync('dist/es/negocios.html'), 'dist/es/negocios.html should exist');
});
```

(These tests are conditional — they no-op until later tasks add the businesses content. They'll catch regressions once everything is in place.)

- [ ] **Step 2: Replace `scripts/build.js`**

```javascript
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

// Map a logical page name to the file path under content/ and templates/.
function contentPath(pageName) {
  return join(ROOT, `content/pages/${pageName}.json`);
}
function templatePath(pageName) {
  return join(ROOT, `templates/pages/${pageName}.html`);
}

// For the homepage, output goes to dist/<lang>/index.html. Other pages go to dist/<lang>/<slug>.html.
function outputPath(lang, pageName, slug) {
  if (pageName === 'home') {
    return join(DIST, lang, 'index.html');
  }
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
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true });
  }
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
```

Note: this drops the previous `ensureRemoved()` retry workaround. If you hit CloudDocs-related EBUSY errors during local dev, re-add a simpler retry — but Vercel's Linux build won't need it.

If you want to keep the existing `ensureRemoved()` defensive logic from PR 1, retain it and call it from `main()` instead of `await rm(DIST, ...)`. Either is acceptable.

- [ ] **Step 3: Run the build manually**

Run: `node scripts/build.js`
Expected:
- `✓ copied legacy passthrough files`
- `⊘ skipping businesses (content or template missing)` (and similarly for faq, tour, advertise — until later tasks add them)
- `✓ wrote dist/en/index.html (...)` and `✓ wrote dist/es/index.html (...)`
- `Build complete.`

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass (31 prior + 2 new conditional = 33; the 2 new ones no-op since content doesn't exist yet).

- [ ] **Step 5: Commit**

```bash
git add scripts/build.js tests/build.test.js
git commit -m "refactor: build runner iterates page-slugs registry"
```

---

## Task 5: Extract content for the four pages

One-time content extraction job. For each legacy HTML file (`businesses.html`, `faq.html`, `tour.html`, `advertise.html`), extract the `T = { en: {...}, es: {...} }` JS dictionary into `content/pages/<page>.json` with structured sections.

This is the largest single task in PR 2 because there are ~170 i18n keys across the four files (27 + 57 + 11 + 75).

**Files:**
- Create: `content/pages/businesses.json`
- Create: `content/pages/faq.json`
- Create: `content/pages/tour.json`
- Create: `content/pages/advertise.json`

- [ ] **Step 1: For each legacy file, find the `T` object**

Read each of `businesses.html`, `faq.html`, `tour.html`, `advertise.html` and locate the inline `<script>` that defines `const T = { en: {...}, es: {...} }` (typically near the bottom of the file, before the language-toggle JS).

Also find the `<title>`, `<meta name="description">`, and any OG tags — those need translations too even though they aren't in `T` (the EN copy is in the meta tag; for ES write a faithful natural MX-Spanish translation).

- [ ] **Step 2: Create `content/pages/businesses.json`**

Skeleton — replace every value with the EXACT string from each source file's `T` object. Keep emoji prefixes, HTML tags (`<em>`, `<br>`), and HTML entities (`&amp;`, `&times;`) as-is.

```json
{
  "meta": {
    "slug":        { "en": "businesses", "es": "negocios" },
    "title":       { "en": "Local Businesses — San José de Gracia", "es": "Negocios Locales — San José de Gracia" },
    "description": { "en": "Browse every local business in San José de Gracia, Jalisco — restaurants, bars, coffee shops, stores, and services. Powered by Google Maps, updated automatically.", "es": "..." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "header": {
    "h1":       { "en": "...", "es": "..." },
    "subtitle": { "en": "...", "es": "..." }
  },
  "tabs": {
    "all":         { "en": "...", "es": "..." },
    "restaurant":  { "en": "...", "es": "..." },
    "bar":         { "en": "...", "es": "..." },
    "coffee":      { "en": "...", "es": "..." },
    "store":       { "en": "...", "es": "..." },
    "park":        { "en": "...", "es": "..." }
  },
  "filter_open":   { "en": "Open Now", "es": "Abierto Ahora" },
  "loading_short": { "en": "Loading...", "es": "Cargando..." },
  "no_results":    { "en": "No {category} found.", "es": "No se encontraron {category}." },
  "no_open":       { "en": "No {category} are open right now.", "es": "Ningún {category} está abierto ahora." },
  "error":         { "en": "...", "es": "..." }
}
```

Add any additional keys that exist in the `businesses.html` source `T` object — there are 27 i18n keys total. Verify completeness with: `grep -oE 'data-i18n="[^"]+"' businesses.html | sort -u | wc -l` should match the count of `"en":` pairs in your JSON (excluding meta strings).

NOTE: the `no_results` and `no_open` strings in the existing source are functions like `(label) => "No " + label + " found."`. In the JSON, store them as templates with a placeholder (e.g. `"No {category} found."`) and the page template will substitute the category — OR keep them as plain strings and let the JS still build them (you don't need to convert dynamic strings to static; the dynamic JS that uses them stays in the page template).

- [ ] **Step 3: Create `content/pages/faq.json`**

The FAQ page has 57 i18n keys — it's structured as Q&A pairs. Group them sensibly:

```json
{
  "meta": {
    "slug":        { "en": "faq", "es": "preguntas" },
    "title":       { "en": "FAQ & Emergency Info — San José de Gracia", "es": "Preguntas Frecuentes — San José de Gracia" },
    "description": { "en": "...", "es": "..." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "h1":          { "en": "...", "es": "..." },
  "intro":       { "en": "...", "es": "..." },
  "sections": [
    {
      "heading":  { "en": "...", "es": "..." },
      "items": [
        { "q": { "en": "...", "es": "..." }, "a": { "en": "...", "es": "..." } }
      ]
    }
  ],
  "emergency": {
    "heading":   { "en": "Emergency Numbers", "es": "Números de Emergencia" },
    "items": [
      { "label": { "en": "Police", "es": "Policía" }, "phone": "..." }
    ]
  }
}
```

Look at the existing `faq.html` structure (it likely has section headings + accordion items + emergency contacts list). Mirror that structure in JSON. If the source uses flat `data-i18n="faq-q1"`, `"faq-a1"`, `"faq-q2"`, ... pairs, group them into the array structure shown above so the template can iterate cleanly.

If you find phone numbers, addresses, or other non-translatable data inside the `T` object (often duplicated EN/ES with the same value), pull them out as flat fields (no `{en, es}` wrapper) — they're shared.

- [ ] **Step 4: Create `content/pages/tour.json`**

The tour page has 11 i18n keys — small. Likely covers a hero, intro paragraph, and possibly stop labels. Most of the actual stop data is in JS that loads onto a Leaflet map. Structure:

```json
{
  "meta": {
    "slug":        { "en": "tour", "es": "recorrido" },
    "title":       { "en": "Walking Tour — San José de Gracia", "es": "Recorrido a Pie — San José de Gracia" },
    "description": { "en": "...", "es": "..." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "h1":         { "en": "...", "es": "..." },
  "intro":      { "en": "...", "es": "..." },
  "map_label":  { "en": "...", "es": "..." }
}
```

Add every key found in `tour.html`'s `T` object.

If the tour stops themselves have translatable labels stored in JS arrays in the page (not in `T`), leave them in JS for now — they're a special case. Note them in your DONE_WITH_CONCERNS report and we'll address in a follow-up.

- [ ] **Step 5: Create `content/pages/advertise.json`**

The advertise page has 75 i18n keys — the largest. It contains pricing tiers, feature lists, and a contact form/CTA. Structure:

```json
{
  "meta": {
    "slug":        { "en": "advertise", "es": "anuncios" },
    "title":       { "en": "Advertise on San José de Gracia — Local Business Listings", "es": "Anúnciate en San José de Gracia — Listados de Negocios Locales" },
    "description": { "en": "...", "es": "..." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "h1":  { "en": "...", "es": "..." },
    "sub": { "en": "...", "es": "..." }
  },
  "tiers": [
    {
      "name":     { "en": "Featured",    "es": "Destacado" },
      "price":    { "en": "$100 MXN/mo", "es": "$100 MXN/mes" },
      "features": [
        { "en": "...", "es": "..." }
      ]
    }
  ],
  "cta": {
    "h2":     { "en": "...", "es": "..." },
    "p":      { "en": "...", "es": "..." },
    "button": { "en": "...", "es": "..." }
  }
}
```

The four monetization tiers from project memory: Featured ($100 MXN/mo), Premium ($300 MXN/mo), Event Spotlight ($200 one-time), Annual ($900 MXN/yr). Each has a name, price, and feature list — all should be in the `tiers` array.

Verify completeness with: `grep -oE 'data-i18n="[^"]+"' advertise.html | sort -u | wc -l` should match the EN pair count.

- [ ] **Step 6: Sanity-parse all four files**

Run:
```bash
for f in content/pages/{businesses,faq,tour,advertise}.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f'))" && echo "$f ok"
done
```

All four should print `ok`.

- [ ] **Step 7: Commit**

```bash
git add content/pages/{businesses,faq,tour,advertise}.json
git commit -m "feat: extract bilingual content for businesses, faq, tour, advertise pages"
```

## When You're in Over Your Head (Task 5 specifically)

Content extraction across 4 files is tedious. If a file has a structure you can't represent cleanly (e.g. translation values that include JavaScript template literals with substitution like `(label) => 'No ' + label`), DO NOT invent a structure. Either:
- Keep the value as a plain string with a `{placeholder}` token (the template's JS can do the substitution at runtime), OR
- Report it as a concern so it can be addressed in a follow-up.

Never silently change the meaning of a translation.

---

## Task 6: Create page templates

Create the four page templates by transforming the existing legacy HTML files. For each:
1. Take the body content (between `<main>` open and close, or between nav close and footer open)
2. Strip the i18n JS dictionary (`T = {...}`) and the `applyLang`/IP-detection logic
3. Replace each `data-i18n="key"` element's inner text with the corresponding `{{token}}`
4. Preserve all other markup, classes, IDs, and non-i18n JS

**Files:**
- Create: `templates/pages/businesses.html`
- Create: `templates/pages/faq.html`
- Create: `templates/pages/tour.html`
- Create: `templates/pages/advertise.html`

- [ ] **Step 1: Create `templates/pages/businesses.html`**

Read the source `businesses.html`. The body contains:
- A header with `<h1>`, subtitle
- Tabs (`<button class="tab" data-type="restaurant">...`)
- Filter toggle (Open Now)
- The `<div id="places-grid">` that JS populates dynamically
- All the JS at the bottom: Maps Places API loader, tab logic, filter logic, render functions

Take everything from `<main>` start to `<main>` end (or the equivalent body content) and substitute tokens. Keep ALL the dynamic Places JS — it stays. Drop only the `T = {...}` translation dictionary and the IP/localStorage language switcher.

Tokens you'll use: `{{header.h1}}`, `{{header.subtitle}}`, `{{tabs.all}}`, `{{tabs.restaurant}}`, etc. — match the structure of `content/pages/businesses.json` from Task 5.

The dynamic JS that uses translations at runtime (e.g. `T[currentLang]['loading-short']`) must be RE-WRITTEN to use static values. Since each built page is single-language, replace `T[currentLang]['loading-short']` with the literal localized string. Easiest way: substitute the i18n-fetching code in JS with build-time tokens. Example before:

```javascript
grid.innerHTML = `<div class="loading-state"><p>${T[currentLang]['loading-short']}</p></div>`;
```

After:
```javascript
grid.innerHTML = `<div class="loading-state"><p>{{loading_short}}</p></div>`;
```

(The `{{loading_short}}` resolves at build time to the per-language string.)

For the `(label) =>` style functions like `T[currentLang]['no-results'](label)`, change them to use a literal template with substitution:

```javascript
// Before:
grid.innerHTML = `<p>${T[currentLang]['no-results'](label)}</p>`;
// After (assuming JSON has "no_results": { "en": "No {category} found.", "es": "..." }):
grid.innerHTML = `<p>${'{{no_results}}'.replace('{category}', label)}</p>`;
```

This pushes the substitution to runtime but uses a build-time-localized template.

- [ ] **Step 2: Create `templates/pages/faq.html`**

Read source `faq.html`. Likely structured as:
- Hero (`<h1>`, intro)
- Accordion sections, each with a heading and Q&A items
- Emergency numbers list

The accordion items in the source were probably hand-written with `data-i18n="faq-q1"`, `"faq-a1"`, etc. In the new template, you have two options:

A. **Hand-render every accordion item** with explicit token paths like `{{sections.0.items.0.q}}` and `{{sections.0.items.0.a}}` — works because the renderer supports array-index dot notation. For ~57 keys this is verbose but mechanical.

B. **Use a JS loop at runtime** that reads from a JSON `<script type="application/json">` block embedded in the page. More elegant but adds runtime JS complexity.

**Use option A.** It keeps the template static and SSR-friendly (matters for SEO).

For the emergency numbers list (where phone numbers are non-translatable), use plain HTML with `{{emergency.items.0.label}}` and the phone number as static text.

- [ ] **Step 3: Create `templates/pages/tour.html`**

Smallest of the four — the body is mostly a Leaflet map container plus intro copy. Replace the few i18n tokens, leave the Leaflet JS alone.

- [ ] **Step 4: Create `templates/pages/advertise.html`**

Largest. The pricing tiers section iterates 4 tiers, each with a feature list. Hand-render all four tiers using `{{tiers.0.name}}`, `{{tiers.0.price}}`, `{{tiers.0.features.0}}`, etc. Tedious but mechanical.

The contact CTA is straightforward token substitution.

- [ ] **Step 5: Run a sanity build for all four pages**

Run from worktree:
```bash
node scripts/build.js 2>&1 | tail -20
```

Expected: 5 `✓ wrote ...` lines per language (10 total writes), no `unresolved token` errors. If any token fails, fix the template (or the JSON) and re-run.

- [ ] **Step 6: Verify no leftover tokens**

```bash
for f in dist/en/{index,businesses,faq,tour,advertise}.html dist/es/{index,negocios,preguntas,recorrido,anuncios}.html; do
  count=$(grep -c '{{' "$f" 2>/dev/null || echo 0)
  echo "$f: $count leftover {{ ... }}"
done
```

Expected: every line ends with `: 0`.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: All tests pass — including the previously-conditional businesses tests added in Task 4 (they now find the files and assert successfully).

- [ ] **Step 8: Commit**

```bash
git add templates/pages/{businesses,faq,tour,advertise}.html
git commit -m "feat: add bilingual templates for businesses, faq, tour, advertise"
```

---

## Task 7: Vercel redirects + delete legacy HTML

Add 301 redirects from old URLs to the new English versions, then delete the legacy HTML so they don't shadow the redirects via passthrough.

**Files:**
- Modify: `vercel.json`
- Delete: `businesses.html`, `faq.html`, `tour.html`, `advertise.html`

- [ ] **Step 1: Update `vercel.json`**

Replace contents with:

```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "redirects": [
    { "source": "/businesses", "destination": "/en/businesses", "permanent": true },
    { "source": "/faq",        "destination": "/en/faq",        "permanent": true },
    { "source": "/tour",       "destination": "/en/tour",       "permanent": true },
    { "source": "/advertise",  "destination": "/en/advertise",  "permanent": true }
  ]
}
```

- [ ] **Step 2: Delete the legacy HTML files**

```bash
git rm businesses.html faq.html tour.html advertise.html
```

(Use `git rm` so the deletion is staged.)

- [ ] **Step 3: Confirm passthrough no longer copies them**

Run: `node scripts/build.js && ls dist/`

Expected: `dist/` contains `index.html`, `admin-businesses.html`, images, but NOT `businesses.html`, `faq.html`, `tour.html`, `advertise.html`. The new pages live in `dist/en/` and `dist/es/`.

- [ ] **Step 4: Verify locally with `vercel dev`**

```bash
vercel dev --yes &
sleep 8
CURL=/usr/bin/curl
echo "=== legacy redirects ==="
for path in /businesses /faq /tour /advertise; do
  code=$($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  loc=$($CURL -sI "http://localhost:3000$path" | grep -i ^location | tr -d '\r')
  echo "$path → $code $loc"
done
echo "=== new bilingual URLs ==="
for path in /en/businesses /es/negocios /en/faq /es/preguntas /en/tour /es/recorrido /en/advertise /es/anuncios; do
  code=$($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "$path → $code"
done
pkill -f "vercel dev"
```

Expected:
- Legacy paths return 308 (Vercel uses 308 for permanent — equivalent to 301 for SEO purposes; Google treats both identically) with a `location` header pointing at `/en/<slug>`
- All 8 bilingual paths return 200

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: Still all green (passthrough test now expects fewer files — update `LEGACY_FILES` if the test enumerates them).

If `tests/passthrough.test.js` lists the deleted files in its `LEGACY_FILES` array, REMOVE those four entries from the array. Concretely, change:

```javascript
const LEGACY_FILES = [
  'index.html',
  'businesses.html',
  'faq.html',
  'tour.html',
  'advertise.html',
  'admin-businesses.html',
  // ...
];
```

to:

```javascript
const LEGACY_FILES = [
  'index.html',
  'admin-businesses.html',
  // ...
];
```

(Only `index.html` and `admin-businesses.html` are still legitimately at root via passthrough. The four removed files now live as `dist/en/<slug>.html` and `dist/es/<slug>.html` — those locations are covered by the build runner tests in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add vercel.json tests/passthrough.test.js
git commit -m "feat: 301-redirect legacy URLs to /en/* and remove old HTML files"
```

(`businesses.html`, etc. were already staged for deletion via `git rm` in Step 2 and may be included in the commit above — verify with `git status` first; if they're not staged, add them with `git add -u`.)

---

## Task 8: Update sitemap

Add the bilingual URLs to `sitemap.xml`. Remove obsolete legacy entries.

**Files:**
- Modify: `sitemap.xml`

- [ ] **Step 1: Replace `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <url>
    <loc>https://sanjosedegracia.net/en/</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/" />
  </url>

  <url>
    <loc>https://sanjosedegracia.net/en/businesses</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/businesses" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/negocios" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/businesses" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/negocios</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/businesses" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/negocios" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/businesses" />
  </url>

  <url>
    <loc>https://sanjosedegracia.net/en/faq</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/faq" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/preguntas" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/faq" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/preguntas</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/faq" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/preguntas" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/faq" />
  </url>

  <url>
    <loc>https://sanjosedegracia.net/en/tour</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/tour" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/recorrido" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/tour" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/recorrido</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/tour" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/recorrido" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/tour" />
  </url>

  <url>
    <loc>https://sanjosedegracia.net/en/advertise</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/advertise" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/anuncios" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/advertise" />
  </url>
  <url>
    <loc>https://sanjosedegracia.net/es/anuncios</loc>
    <lastmod>2026-05-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/advertise" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/anuncios" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/advertise" />
  </url>

</urlset>
```

10 URLs total. Old single-URL entries for `/`, `/businesses`, `/advertise` are removed — they're either redirected or replaced.

- [ ] **Step 2: Sanity-parse the XML**

Run: `xmllint --noout sitemap.xml && echo ok`
Expected: `ok` (or just no error output if `xmllint` isn't available — alternatively use Node: `node -e "require('fs').readFileSync('sitemap.xml','utf8'); console.log('ok')"`)

- [ ] **Step 3: Verify it's served correctly after rebuild**

```bash
node scripts/build.js
test -f dist/sitemap.xml && echo "sitemap copied to dist/"
head -5 dist/sitemap.xml
```

Expected: file exists in dist/, header is the XML declaration.

- [ ] **Step 4: Commit**

```bash
git add sitemap.xml
git commit -m "feat: update sitemap with bilingual URLs and hreflang alternates"
```

---

## Task 9: Local end-to-end smoke test

Verify the entire PR works as expected via `vercel dev` before pushing.

- [ ] **Step 1: Start `vercel dev` in background**

```bash
vercel dev --yes > /tmp/vercel-pr2.log 2>&1 &
sleep 8
```

- [ ] **Step 2: Test all routes**

```bash
CURL=/usr/bin/curl
echo "=== ROOTS ==="
for path in / /en/ /es/; do
  echo "$path → HTTP $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")"
done

echo "=== BILINGUAL PAGES ==="
for path in /en/businesses /es/negocios /en/faq /es/preguntas /en/tour /es/recorrido /en/advertise /es/anuncios; do
  echo "$path → HTTP $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")"
done

echo "=== LEGACY REDIRECTS ==="
for path in /businesses /faq /tour /advertise; do
  loc=$($CURL -sI "http://localhost:3000$path" | grep -i ^location | tr -d '\r' | awk '{print $2}')
  code=$($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  echo "$path → HTTP $code → $loc"
done

echo "=== STATIC ==="
for path in /sitemap.xml /robots.txt /favicon-32.png /admin-businesses; do
  echo "$path → HTTP $($CURL -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")"
done
```

Expected:
- Roots: `/` 200 (legacy index.html), `/en/` 200, `/es/` 200
- Bilingual: all 8 → 200
- Legacy redirects: all 4 → 308 with Location: `/en/<slug>`
- Static: 200 for sitemap, robots, favicon, admin-businesses

- [ ] **Step 3: Inspect headers on one page**

```bash
$CURL -s http://localhost:3000/es/negocios | grep -E '<html lang|hreflang|<title>|canonical'
```

Expected:
- `<html lang="es-MX">`
- canonical → `https://sanjosedegracia.net/es/negocios`
- hreflang en → `/en/businesses`, hreflang es → `/es/negocios`, x-default → `/en/businesses`
- title in Spanish

- [ ] **Step 4: Stop the dev server**

```bash
pkill -f "vercel dev"
```

- [ ] **Step 5: No commit — verification only**

If anything failed, fix the underlying file (template, content, redirect, etc.) and re-run.

---

## Task 10: Push, PR, deploy

Now that Vercel-Git is connected (per project memory), pushing the branch will auto-create a preview, and merging will auto-deploy production.

- [ ] **Step 1: Push the branch**

```bash
git status
git log --oneline -10
git push -u origin feat/pr2-bilingual-pages
```

If push fails with auth error, fall back to `gh auth status` to confirm credentials, or have the user run the push manually.

- [ ] **Step 2: Open the PR via gh**

```bash
gh pr create --base main --head feat/pr2-bilingual-pages \
  --title "feat: PR 2 — migrate businesses/faq/tour/advertise to bilingual URLs" \
  --body "$(cat <<'EOF'
## Summary

Second of nine PRs in the SEO overhaul. Migrates the four non-homepage public pages to the bilingual build system established in PR 1.

- New URLs: \`/en/{businesses,faq,tour,advertise}\` and \`/es/{negocios,preguntas,recorrido,anuncios}\`
- Legacy URLs (\`/businesses\`, \`/faq\`, \`/tour\`, \`/advertise\`) 301-redirect to their English versions
- Nav links in the base layout are now language-aware via a new \`nav_urls\` context variable + \`page-slugs.json\` registry
- Sitemap updated with all 10 new URLs + \`hreflang\` alternates
- Legacy HTML files deleted from repo root (no longer needed)

## Test plan

- [ ] Vercel preview: all 8 bilingual URLs return 200
- [ ] Vercel preview: 4 legacy paths 308-redirect to \`/en/<slug>\`
- [ ] \`/\` (legacy homepage) and \`/admin-businesses\` still return 200
- [ ] \`/sitemap.xml\` returns 200 with the new bilingual entries
- [ ] Browser visit: \`/es/negocios\` shows Spanish UI, English content unchanged
- [ ] Browser visit: nav links from \`/es/\` go to \`/es/...\` paths, nav links from \`/en/\` go to \`/en/...\` paths

## Out of scope (later PRs)

- Per-business static pages with LocalBusiness schema (PR 4)
- \`/\` root-language redirect (PR 3)
- \`.org\` 301 redirect (PR 6)
EOF
)"
```

- [ ] **Step 3: Wait for Vercel preview deploy**

After push, Vercel auto-deploys a preview. Find the preview URL via the GH PR check or:

```bash
sleep 60
gh pr checks --repo ninjackster/sjdg-community-site $(gh pr view --json number -q .number)
```

- [ ] **Step 4: Smoke-test the preview URL**

Same script as Task 9 Step 2, but replacing `http://localhost:3000` with the preview URL. All routes should match local behavior.

- [ ] **Step 5: Hand off to user for review and merge**

Stop here. The user reviews the preview in a browser, then squash-merges via `gh pr merge --squash`. Vercel auto-deploys main to production.

After merge, the worktree can be cleaned up:
```bash
cd /tmp
git -C "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage" worktree remove .worktrees/pr2-bilingual-pages
git -C "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage" branch -D feat/pr2-bilingual-pages
```

---

## Self-Review Checklist (controller runs before handoff)

- [ ] Spec coverage: PR 2 row in the spec is fully covered — businesses/faq/tour/advertise all bilingual ✓, Spanish slugs ✓, legacy redirects ✓
- [ ] No "TBD" / "implement later" / vague handwave steps
- [ ] Function names consistent: `buildPage`, `buildNavUrls`, `urlFor`, `pathFor`, `loadContent`, `resolveLang`, `passthrough`
- [ ] Tests precede implementation in TDD tasks (Task 2)
- [ ] Each task ends with a commit
- [ ] Legacy `/` continues to serve `index.html` until PR 3 — explicitly stated and tested

## What ships in PR 2

- 4 new bilingual page pairs (8 URLs total) with correct hreflang
- Language-aware nav across the entire site
- 4 permanent redirects from legacy URLs (preserves any inbound link equity)
- Updated sitemap.xml with hreflang alternates
- ~170 i18n keys migrated from inline JS to structured JSON
- Tests: ~33 (PR 1's 27 + 4 new build-page + 2 conditional build)

## What does NOT ship in PR 2

- `/` root-language redirect → PR 3
- hreflang on the legacy index.html → PR 3 (or moot if `/` becomes a redirect)
- Per-business static pages → PR 4
- Topic / tourist landing pages → PR 5
- Search Console domain property + `.org` redirect → PR 6
