# PR 1 — Build System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a custom Node build system that generates bilingual static HTML from a single content source, and migrate the homepage end-to-end as proof. Legacy URLs (`/`, `/businesses`, `/faq`, `/tour`, `/advertise`) continue to serve unchanged. New bilingual homepage ships at `/en/` and `/es/` alongside.

**Architecture:**
Source-of-truth content lives in `content/` as JSON (`{en, es}` per string). HTML templates with `{{token}}` placeholders live in `templates/`. A small Node script (`scripts/build.js`, zero runtime deps) renders each template once per language and writes to `dist/{en,es}/`. The build also passthrough-copies all legacy HTML and assets to `dist/`. Vercel switches from serving the repo root to serving `dist/`. Tests use Node's built-in `node:test` runner — no test framework dep.

**Tech Stack:** Node 20+, vanilla JavaScript (no TypeScript, no bundler, no template engine library). Vercel for hosting.

**Project root:** `/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage`

**Out of scope for PR 1:** Migrating businesses/faq/tour/advertise pages (PR 2). hreflang tags are added in PR 1 for the homepage only as part of the proof. Legacy URLs continue to serve their current content unchanged.

---

## File Structure

**New files (created in this PR):**

| Path | Responsibility |
|------|---------------|
| `package.json` | Node project manifest, build scripts, declares `"type": "module"` |
| `.gitignore` | Ignores `dist/`, `node_modules/` |
| `scripts/build.js` | Entry point — orchestrates content load → template render → write `dist/` → copy legacy passthrough |
| `scripts/lib/render.js` | Tiny string-template renderer (`{{token}}` substitution) |
| `scripts/lib/content.js` | Loads JSON content files, resolves `{en, es}` for a given language |
| `scripts/lib/build-page.js` | Renders one page template with content + shared partials, injects hreflang |
| `scripts/lib/passthrough.js` | Copies legacy HTML and static assets to `dist/` |
| `content/shared/nav.json` | Translatable nav strings |
| `content/shared/footer.json` | Translatable footer strings |
| `content/shared/common.json` | Site-wide constants (site name, contact email, social URLs) |
| `content/pages/home.json` | All translatable strings + meta for the homepage |
| `templates/layouts/base.html` | Outer HTML shell — `<head>`, `<nav>`, `<footer>` with `{{tokens}}` |
| `templates/pages/home.html` | Homepage body |
| `tests/render.test.js` | Tests for the template renderer |
| `tests/content.test.js` | Tests for the content loader |
| `tests/build-page.test.js` | Tests for page rendering (correct lang, hreflang, no leftover tokens) |
| `tests/build.test.js` | End-to-end test — run build, assert `dist/` structure |

**Modified files:**

| Path | Change |
|------|--------|
| `vercel.json` | Add `buildCommand`, `outputDirectory: "dist"`. Keep `cleanUrls: true`. |

**Untouched in PR 1:** `index.html`, `businesses.html`, `faq.html`, `tour.html`, `advertise.html`, `admin-businesses.html`, `api/`, `*.png`, `*.webp`, `*.jpg`, `robots.txt`, `sitemap.xml` — all copied verbatim into `dist/` by the passthrough step so the live site keeps working.

---

## Task 1: Initialize Node project

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sjdg-webpage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "node scripts/build.js",
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Create `.gitignore`** (or append if it exists)

```
node_modules/
dist/
.DS_Store
.env
.env.local
.vercel/
```

If `.gitignore` already exists, add only the lines that are missing.

- [ ] **Step 3: Verify Node and npm work**

Run: `node --version && npm --version`
Expected: Node version ≥ 20.

- [ ] **Step 4: Verify `npm test` runs (and passes with no tests yet)**

Run: `npm test`
Expected: Output mentions 0 tests, exits 0.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: initialize Node project for build system"
```

---

## Task 2: Tiny template renderer (TDD)

The renderer substitutes `{{key}}` and `{{nested.key}}` tokens in a string from a context object. Throws if any token is unresolved (catches missing translations early).

**Files:**
- Create: `tests/render.test.js`
- Create: `scripts/lib/render.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/render.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../scripts/lib/render.js';

test('substitutes a simple token', () => {
  assert.equal(render('Hello {{name}}', { name: 'World' }), 'Hello World');
});

test('substitutes multiple tokens', () => {
  assert.equal(
    render('{{greeting}}, {{name}}!', { greeting: 'Hola', name: 'Jaime' }),
    'Hola, Jaime!'
  );
});

test('substitutes nested keys via dot notation', () => {
  assert.equal(
    render('{{user.name}}', { user: { name: 'Ana' } }),
    'Ana'
  );
});

test('preserves whitespace inside braces', () => {
  assert.equal(render('{{ name }}', { name: 'Luis' }), 'Luis');
});

test('throws when a token is unresolved', () => {
  assert.throws(
    () => render('Hi {{missing}}', {}),
    /unresolved token: missing/i
  );
});

test('returns input unchanged when there are no tokens', () => {
  assert.equal(render('plain string', { x: 1 }), 'plain string');
});

test('does not double-render — output containing braces is left alone', () => {
  assert.equal(
    render('{{html}}', { html: '{{not-a-token}}' }),
    '{{not-a-token}}'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: All 7 tests fail with module-not-found error for `../scripts/lib/render.js`.

- [ ] **Step 3: Implement the renderer**

Create `scripts/lib/render.js`:

```javascript
const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolve(ctx, key) {
  return key.split('.').reduce((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[part];
  }, ctx);
}

export function render(template, ctx) {
  // Single pass — does not re-scan output, so values containing braces are safe.
  return template.replace(TOKEN_RE, (_, key) => {
    const value = resolve(ctx, key);
    if (value === undefined) {
      throw new Error(`unresolved token: ${key}`);
    }
    return String(value);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/render.test.js scripts/lib/render.js
git commit -m "feat: add template renderer with token substitution"
```

---

## Task 3: Content loader (TDD)

The loader reads a JSON file with `{en, es}` shaped values and returns a flattened context for a single language.

**Files:**
- Create: `tests/content.test.js`
- Create: `scripts/lib/content.js`
- Create: `tests/fixtures/sample.json`

- [ ] **Step 1: Write a fixture**

Create `tests/fixtures/sample.json`:

```json
{
  "title":       { "en": "Hello",        "es": "Hola" },
  "description": { "en": "A test page.", "es": "Una página de prueba." },
  "nested": {
    "label": { "en": "Click",  "es": "Haz clic" }
  },
  "constant": "not-translated"
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/content.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, resolveLang } from '../scripts/lib/content.js';

test('loadContent reads JSON from a path', async () => {
  const data = await loadContent('tests/fixtures/sample.json');
  assert.equal(data.title.en, 'Hello');
  assert.equal(data.title.es, 'Hola');
});

test('resolveLang flattens {en,es} fields to a single language', () => {
  const data = {
    title: { en: 'Hello', es: 'Hola' },
    constant: 'shared',
  };
  assert.deepEqual(resolveLang(data, 'en'), { title: 'Hello', constant: 'shared' });
  assert.deepEqual(resolveLang(data, 'es'), { title: 'Hola',  constant: 'shared' });
});

test('resolveLang recurses into nested objects', () => {
  const data = {
    nav: {
      home:  { en: 'Home',     es: 'Inicio' },
      about: { en: 'About',    es: 'Acerca' },
    },
  };
  assert.deepEqual(resolveLang(data, 'es'), {
    nav: { home: 'Inicio', about: 'Acerca' },
  });
});

test('resolveLang preserves arrays and recurses into their items', () => {
  const data = {
    items: [
      { label: { en: 'A', es: 'Uno' } },
      { label: { en: 'B', es: 'Dos' } },
    ],
  };
  assert.deepEqual(resolveLang(data, 'es'), {
    items: [{ label: 'Uno' }, { label: 'Dos' }],
  });
});

test('resolveLang throws when the requested language is missing', () => {
  const data = { title: { en: 'Only English' } };
  assert.throws(() => resolveLang(data, 'es'), /missing translation for lang "es"/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: 5 new tests fail with module-not-found for `../scripts/lib/content.js`.

- [ ] **Step 4: Implement the content loader**

Create `scripts/lib/content.js`:

```javascript
import { readFile } from 'node:fs/promises';

const LANGS = ['en', 'es'];

function isTranslationLeaf(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(k => LANGS.includes(k));
}

export function resolveLang(node, lang) {
  if (isTranslationLeaf(node)) {
    if (!(lang in node)) {
      throw new Error(`missing translation for lang "${lang}" in ${JSON.stringify(node)}`);
    }
    return node[lang];
  }
  if (Array.isArray(node)) {
    return node.map(item => resolveLang(item, lang));
  }
  if (node !== null && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = resolveLang(value, lang);
    }
    return out;
  }
  return node;
}

export async function loadContent(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All 12 tests pass (7 from Task 2 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add tests/content.test.js scripts/lib/content.js tests/fixtures/sample.json
git commit -m "feat: add bilingual content loader"
```

---

## Task 4: Extract homepage content into JSON

This is a one-time content-extraction job. Open `index.html`, find the `T = {en: {...}, es: {...}}` translation object (around line 1391–1557), and re-key it into the structured shape below. Also extract meta tags (title, description, OG, schema) into the JSON.

**Files:**
- Create: `content/pages/home.json`
- Create: `content/shared/nav.json`
- Create: `content/shared/footer.json`
- Create: `content/shared/common.json`

- [ ] **Step 1: Create `content/shared/common.json`**

```json
{
  "site_name":       "San José de Gracia",
  "site_url":        "https://sanjosedegracia.net",
  "contact_email":   "sanjosedegraciajalisco@gmail.com",
  "ga_id":           "G-Z4TGNPX9J5",
  "default_og_image": "https://sanjosedegracia.net/pueblo-1.webp"
}
```

- [ ] **Step 2: Create `content/shared/nav.json` by extracting nav strings from `index.html`**

Read `index.html` lines 985–1009 to find the seven nav items. Write:

```json
{
  "directory":     { "en": "Directory",    "es": "Directorio" },
  "stay":          { "en": "Stay",         "es": "Hospedaje" },
  "events":        { "en": "Events",       "es": "Eventos" },
  "getting_here":  { "en": "Getting Here", "es": "Cómo Llegar" },
  "contact":       { "en": "Contact",      "es": "Contacto" },
  "faq":           { "en": "FAQ",          "es": "Preguntas" },
  "skip_link":     { "en": "Skip to main content", "es": "Saltar al contenido principal" }
}
```

Verify each Spanish string against the actual ES values in the `T` object in `index.html` — replace with the exact existing translation if it differs.

- [ ] **Step 3: Create `content/shared/footer.json` by extracting footer strings from `index.html`**

Find the footer section in `index.html` (search for `<footer` or `footer-`). Build:

```json
{
  "accessibility_statement": {
    "en": "We are committed to making this site accessible to every visitor. If you encounter any difficulty, please <a href=\"https://jaimem.com\" target=\"_blank\" rel=\"noopener\">contact us</a>.",
    "es": "Nos comprometemos a hacer este sitio accesible para todos los visitantes. Si tienes alguna dificultad, por favor <a href=\"https://jaimem.com\" target=\"_blank\" rel=\"noopener\">contáctanos</a>."
  },
  "contact_label": { "en": "Contact", "es": "Contacto" },
  "copyright":     { "en": "© 2026 San José de Gracia", "es": "© 2026 San José de Gracia" }
}
```

If the source file has additional footer strings, add them. If the copyright text differs, use what's in the source.

- [ ] **Step 4: Create `content/pages/home.json` by extracting all homepage translations**

Read `index.html` lines 1391–1557 (the `T = {en, es}` object) and the surrounding HTML. Re-key into structured sections. Use this skeleton, replacing each placeholder with the actual existing translation from the source:

```json
{
  "meta": {
    "slug":        { "en": "",                  "es": "" },
    "title":       { "en": "San José de Gracia — Jalisco, México", "es": "San José de Gracia — Jalisco, México" },
    "description": {
      "en": "San José de Gracia — a historic highland town in the Altos de Jalisco, Jalisco, México. Discover local businesses, places to stay, festivals, and how to get here.",
      "es": "San José de Gracia — un pueblo histórico en los Altos de Jalisco, México. Descubre negocios locales, hospedaje, fiestas y cómo llegar."
    },
    "og_locale_primary":   { "en": "en_US",     "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX",     "es": "en_US" }
  },
  "hero": {
    "eyebrow":  { "en": "Jalisco, México · Est. 1793",                                                 "es": "Jalisco, México · Fundado 1793" },
    "headline": { "en": "...COPY EXACT EN STRING FROM SOURCE...",                                     "es": "...COPY EXACT ES STRING FROM SOURCE..." },
    "sub":      { "en": "A quiet jewel in the Altos de Jalisco highlands — 95 km northeast of Guadalajara, a world away from the ordinary.", "es": "..." },
    "btn1":     { "en": "Find a Place to Stay", "es": "..." },
    "btn2":     { "en": "Explore the Town",     "es": "..." },
    "btn3":     { "en": "Walking Tour",         "es": "..." },
    "scroll":   { "en": "Scroll",               "es": "..." }
  },
  "about": {
    "label":  { "en": "Our Town",                                            "es": "..." },
    "h2":     { "en": "Where the highlands<br>slow everything down",          "es": "..." },
    "p":      { "en": "Nestled at 1,980 meters above sea level...",           "es": "..." },
    "stats": {
      "founded":  { "en": "Year Founded",     "es": "..." },
      "altitude": { "en": "Altitude",         "es": "..." },
      "distance": { "en": "From Guadalajara", "es": "..." },
      "weather":  { "en": "Right Now",        "es": "..." }
    }
  },
  "historia": {
    "label": { "en": "Our History",                                          "es": "..." },
    "h2":    { "en": "A Town with <em>a Story</em>",                          "es": "..." },
    "p":     { "en": "San José de Gracia has been shaped by faith...",        "es": "..." }
  },
  "events": {
    "label":  { "en": "Festividades",                                        "es": "..." },
    "h2":     { "en": "Celebrations &amp;<br><em>Traditions</em>",            "es": "..." },
    "intro":  { "en": "San José de Gracia comes alive throughout the year...", "es": "..." },
    "items": [
      {
        "month": { "en": "March 19",                          "es": "..." },
        "name":  { "en": "Fiesta Patronal de San José",       "es": "..." },
        "desc":  { "en": "The town's biggest celebration...", "es": "..." }
      }
    ]
  }
}
```

The full extraction must cover **every `data-i18n` key in `index.html`**. Search `index.html` for `data-i18n=` and ensure every key has a corresponding entry in `home.json`.

The `events.items` array should contain all 6 events that exist in the source (Fiesta Patronal de San José, Semana Santa, Fiestas Patrias, Virgen de Guadalupe, Las Posadas, Tianguis Semanal).

Continue extracting `stay` (rentals), `cta`, `rental-*`, etc. Use the structure that makes sense; group related strings.

- [ ] **Step 5: Verify content is complete**

Run this script to count i18n keys in source vs JSON:

```bash
echo "Source data-i18n keys:"
grep -oE 'data-i18n="[^"]+"' index.html | sort -u | wc -l
echo "Keys in home.json (rough count):"
grep -oE '"en":' content/pages/home.json | wc -l
```

The numbers should be close. The JSON count may exceed the source count because we also extract meta strings.

- [ ] **Step 6: Commit**

```bash
git add content/
git commit -m "feat: extract homepage translations into structured JSON content files"
```

---

## Task 5: Page builder with hreflang (TDD)

Combines content + base layout + page template into a final HTML string for one language. Injects hreflang tags pointing at the alternate language.

**Files:**
- Create: `tests/build-page.test.js`
- Create: `scripts/lib/build-page.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/build-page.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPage } from '../scripts/lib/build-page.js';

const LAYOUT = `<!DOCTYPE html>
<html lang="{{lang}}">
<head>
<title>{{meta.title}}</title>
<link rel="canonical" href="{{canonical}}" />
{{hreflang}}
</head>
<body>{{content}}</body>
</html>`;

const PAGE = `<h1>{{hero.headline}}</h1><p>{{hero.sub}}</p>`;

const CONTENT = {
  meta: {
    slug:  { en: '',          es: '' },
    title: { en: 'EN Title',  es: 'ES Título' },
  },
  hero: {
    headline: { en: 'Hello',  es: 'Hola' },
    sub:      { en: 'Sub EN', es: 'Sub ES' },
  },
};

const SHARED = {};
const SITE_URL = 'https://example.com';

test('builds an English page with EN content', () => {
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<p>Sub EN<\/p>/);
  assert.match(html, /<title>EN Title<\/title>/);
});

test('builds a Spanish page with ES content', () => {
  const html = buildPage({
    lang: 'es',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<html lang="es-MX">/);
  assert.match(html, /<h1>Hola<\/h1>/);
  assert.match(html, /<p>Sub ES<\/p>/);
});

test('emits canonical URL pointing at the current-language URL', () => {
  const html = buildPage({
    lang: 'es',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/es\/" \/>/);
});

test('emits hreflang tags for every language plus x-default', () => {
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/example\.com\/en\/" \/>/);
  assert.match(html, /<link rel="alternate" hreflang="es" href="https:\/\/example\.com\/es\/" \/>/);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/example\.com\/en\/" \/>/);
});

test('hreflang reflects translated slugs', () => {
  const content = {
    meta: {
      slug:  { en: 'businesses', es: 'negocios' },
      title: { en: 'B', es: 'N' },
    },
    hero: { headline: { en: 'X', es: 'Y' }, sub: { en: 'a', es: 'b' } },
  };
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /hreflang="en" href="https:\/\/example\.com\/en\/businesses" \/>/);
  assert.match(html, /hreflang="es" href="https:\/\/example\.com\/es\/negocios" \/>/);
});

test('throws if any token is left unresolved (catches missing translations)', () => {
  const broken = {
    meta: { slug: { en: '', es: '' }, title: { en: 'T', es: 'T' } },
    hero: { headline: { en: 'X', es: 'Y' } },  // sub is missing
  };
  assert.throws(
    () => buildPage({
      lang: 'en',
      layout: LAYOUT,
      pageTemplate: PAGE,
      content: broken,
      shared: SHARED,
      siteUrl: SITE_URL,
    }),
    /unresolved token/i
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 6 new tests fail with module-not-found for `../scripts/lib/build-page.js`.

- [ ] **Step 3: Implement the page builder**

Create `scripts/lib/build-page.js`:

```javascript
import { render } from './render.js';
import { resolveLang } from './content.js';

const LANGS = ['en', 'es'];
const HTML_LANG = { en: 'en', es: 'es-MX' };
const DEFAULT_LANG = 'en';

function urlFor(siteUrl, lang, slug) {
  return slug ? `${siteUrl}/${lang}/${slug}` : `${siteUrl}/${lang}/`;
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

export function buildPage({ lang, layout, pageTemplate, content, shared, siteUrl }) {
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
  };

  // Render the page body first, then inject it into the layout.
  const body = render(pageTemplate, ctx);
  return render(layout, { ...ctx, content: body });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 18 tests pass (12 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add tests/build-page.test.js scripts/lib/build-page.js
git commit -m "feat: page builder with hreflang and canonical injection"
```

---

## Task 6: Create the layout and homepage templates

These templates port the existing `index.html` structure into placeholder form. Copy the source HTML and replace each translatable string with `{{key}}` matching the `home.json` shape from Task 4.

**Files:**
- Create: `templates/layouts/base.html`
- Create: `templates/pages/home.html`

- [ ] **Step 1: Create `templates/layouts/base.html`**

The base layout is the outer shell — `<head>`, `<nav>`, `<footer>`, GA snippet, fonts. Copy these sections from `index.html` and replace translatable text with tokens. The page-specific body is injected via `{{content}}`.

Skeleton:

```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id={{shared.common.ga_id}}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '{{shared.common.ga_id}}');
  </script>

  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{meta.title}}</title>

  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <meta name="description" content="{{meta.description}}" />
  <link rel="canonical" href="{{canonical}}" />
  {{hreflang}}

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{{canonical}}" />
  <meta property="og:title" content="{{meta.title}}" />
  <meta property="og:description" content="{{meta.description}}" />
  <meta property="og:image" content="{{shared.common.default_og_image}}" />
  <meta property="og:locale" content="{{meta.og_locale_primary}}" />
  <meta property="og:locale:alternate" content="{{meta.og_locale_alternate}}" />
  <meta property="og:site_name" content="{{shared.common.site_name}}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{{meta.title}}" />
  <meta name="twitter:description" content="{{meta.description}}" />
  <meta name="twitter:image" content="{{shared.common.default_og_image}}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

  <!-- PAGE-SPECIFIC HEAD GOES HERE — leave room for {{head_extra}} if a page needs more -->
</head>
<body>
  <a class="skip-link" href="#main-content">{{shared.nav.skip_link}}</a>

  <nav id="nav">
    <a href="/{{lang}}/" class="nav-logo">
      <img src="/jmm-logo.png" alt="" />
      <span>{{shared.common.site_name}}</span>
    </a>
    <ul class="nav-links">
      <li><a href="/{{lang}}/businesses">{{shared.nav.directory}}</a></li>
      <li><a href="#stay">{{shared.nav.stay}}</a></li>
      <li><a href="#events">{{shared.nav.events}}</a></li>
      <li><a href="#getting-here">{{shared.nav.getting_here}}</a></li>
      <li><a href="#contact">{{shared.nav.contact}}</a></li>
      <li><a href="/{{lang}}/faq">{{shared.nav.faq}}</a></li>
    </ul>
    <div class="nav-lang">
      <a href="/en/" class="lang-opt">EN</a>
      <span class="lang-sep">/</span>
      <a href="/es/" class="lang-opt">ES</a>
    </div>
  </nav>

  <main id="main-content">
    {{content}}
  </main>

  <footer>
    <p>{{shared.footer.accessibility_statement}}</p>
    <p>{{shared.footer.contact_label}}: <a href="mailto:{{shared.common.contact_email}}">{{shared.common.contact_email}}</a></p>
    <p>{{shared.footer.copyright}}</p>
  </footer>
</body>
</html>
```

**Critical:** also extract the `<style>` block from `index.html` (lines ~81–960) and either inline it inside `<head>` (simplest) or extract it to a shared CSS file `dist/styles/base.css` referenced from the layout. For PR 1 simplicity, **inline it inside `<head>`** — exactly as the source does. We'll extract to a shared CSS file in a later PR.

Copy the entire `<style>...</style>` block verbatim from `index.html` into the layout's `<head>`.

- [ ] **Step 2: Create `templates/pages/home.html`**

Take the body content from `index.html` (everything inside `<main>` or between the nav close and footer open — roughly lines 1024–1380) and replace every `data-i18n="key"` element's text content with the matching `{{key}}` token from `home.json`.

For example, the source line:
```html
<p class="hero-eyebrow" data-i18n="hero-eyebrow">Jalisco, México · Est. 1793</p>
```

Becomes:
```html
<p class="hero-eyebrow">{{hero.eyebrow}}</p>
```

Continue through every translatable element. Keep all classes, structure, scripts, and non-translatable markup identical.

**Important:** strip the existing client-side language toggle code from the page template — the per-language version is now baked at build time. Specifically:
- Do NOT include the `T = {en, es}` JS object
- Do NOT include `applyLang()`, `setLanguage()`, the IP-detection fetch, or `localStorage` lang persistence
- Keep all other JS (rental popup, mobile menu, scroll behaviors, weather, schema.org JSON-LD)

- [ ] **Step 3: Sanity check — open one of the templates in an editor and confirm**

Verify by opening `templates/pages/home.html`:
- Every `data-i18n=` attribute is gone (replaced by `{{token}}`)
- No `T = {` translation object remains
- All other markup is intact

- [ ] **Step 4: Commit**

```bash
git add templates/
git commit -m "feat: add base layout and homepage template with i18n tokens"
```

---

## Task 7: Build runner (TDD)

Top-level `scripts/build.js` orchestrates: clear `dist/`, build the homepage in EN and ES, write to `dist/{en,es}/index.html`.

**Files:**
- Create: `tests/build.test.js`
- Create: `scripts/build.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/build.test.js`:

```javascript
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

before(() => {
  // Run the build once for all tests below.
  execSync('node scripts/build.js', { stdio: 'inherit' });
});

test('build creates dist/en/index.html', () => {
  assert.ok(existsSync('dist/en/index.html'), 'dist/en/index.html should exist');
});

test('build creates dist/es/index.html', () => {
  assert.ok(existsSync('dist/es/index.html'), 'dist/es/index.html should exist');
});

test('English homepage contains English hero copy', () => {
  const html = readFileSync('dist/en/index.html', 'utf8');
  assert.match(html, /Jalisco, México · Est\. 1793/);
  assert.match(html, /<html lang="en">/);
});

test('Spanish homepage contains Spanish hero copy and lang attribute', () => {
  const html = readFileSync('dist/es/index.html', 'utf8');
  assert.match(html, /<html lang="es-MX">/);
  // The exact ES eyebrow string from home.json — adjust if your JSON uses different wording:
  assert.match(html, /Fundado 1793|Jalisco, México · Fundado/);
});

test('Both pages include hreflang tags pointing at each other', () => {
  for (const path of ['dist/en/index.html', 'dist/es/index.html']) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, /hreflang="en" href="https:\/\/sanjosedegracia\.net\/en\/"/);
    assert.match(html, /hreflang="es" href="https:\/\/sanjosedegracia\.net\/es\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/sanjosedegracia\.net\/en\/"/);
  }
});

test('Built pages contain no leftover {{tokens}}', () => {
  for (const path of ['dist/en/index.html', 'dist/es/index.html']) {
    const html = readFileSync(path, 'utf8');
    assert.doesNotMatch(html, /\{\{[\w.\s]+\}\}/, `unresolved token in ${path}`);
  }
});

test('Canonical URL is language-specific', () => {
  const en = readFileSync('dist/en/index.html', 'utf8');
  const es = readFileSync('dist/es/index.html', 'utf8');
  assert.match(en, /<link rel="canonical" href="https:\/\/sanjosedegracia\.net\/en\/" \/>/);
  assert.match(es, /<link rel="canonical" href="https:\/\/sanjosedegracia\.net\/es\/" \/>/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: build.test.js tests fail because `scripts/build.js` doesn't exist or doesn't produce output.

- [ ] **Step 3: Implement the build runner**

Create `scripts/build.js`:

```javascript
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lib/content.js';
import { buildPage } from './lib/build-page.js';

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

async function main() {
  // Clean dist/
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true });
  }
  await ensureDir(DIST);

  const shared = await loadShared();
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');

  await buildHome({ shared, layout });

  console.log('\nBuild complete.');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the build manually first**

Run: `node scripts/build.js`
Expected: Console output shows two `✓ wrote ...` lines and `Build complete.`. No errors. `dist/en/index.html` and `dist/es/index.html` exist.

If you get `unresolved token: <something>`, that means `home.json` is missing a key the template uses. Add the key to `home.json` and re-run.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All 25 tests pass (18 prior + 7 new).

- [ ] **Step 6: Commit**

```bash
git add tests/build.test.js scripts/build.js
git commit -m "feat: build runner generates bilingual homepage to dist/"
```

---

## Task 8: Legacy passthrough (TDD)

Copy unchanged HTML and assets to `dist/` so the live site keeps working when Vercel switches to serving from `dist/`. This is the safety net for PRs 2–9.

**Files:**
- Create: `tests/passthrough.test.js`
- Create: `scripts/lib/passthrough.js`
- Modify: `scripts/build.js` (add a call to passthrough)

- [ ] **Step 1: Write the failing tests**

Create `tests/passthrough.test.js`:

```javascript
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

before(() => {
  execSync('node scripts/build.js', { stdio: 'inherit' });
});

const LEGACY_FILES = [
  'index.html',
  'businesses.html',
  'faq.html',
  'tour.html',
  'advertise.html',
  'admin-businesses.html',
  'robots.txt',
  'sitemap.xml',
  'favicon-32.png',
  'favicon-48.png',
  'favicon-192.png',
  'apple-touch-icon.png',
  'jmm-logo.png',
  'pueblo-1.webp',
  'pueblo-2.webp',
  'pueblo-3.webp',
  'church-hero.jpg',
  'temple.png',
];

test('passthrough copies all legacy HTML and assets to dist/', () => {
  for (const file of LEGACY_FILES) {
    assert.ok(existsSync(`dist/${file}`), `dist/${file} should exist`);
    assert.ok(statSync(`dist/${file}`).size > 0, `dist/${file} should be non-empty`);
  }
});

test('passthrough copies api/ directory', () => {
  assert.ok(existsSync('dist/api/blocked-places.js'), 'dist/api/blocked-places.js should exist');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: passthrough.test.js fails — files don't exist in `dist/`.

- [ ] **Step 3: Implement the passthrough module**

Create `scripts/lib/passthrough.js`:

```javascript
import { cp, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

// File and directory names at the project root that should be copied verbatim to dist/.
// Anything not in this list is ignored (build outputs, dotfiles, content/, templates/, etc.).
const PASSTHROUGH_EXTENSIONS = new Set([
  '.html', '.png', '.webp', '.jpg', '.jpeg', '.svg', '.ico',
  '.txt', '.xml', '.js', '.css', '.json', '.woff', '.woff2',
]);

const PASSTHROUGH_DIRS = new Set(['api']);

const EXCLUDE_FILES = new Set([
  'package.json', 'package-lock.json', '.gitignore', 'vercel.json',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.vercel', '.claude',
  'content', 'templates', 'scripts', 'tests', 'docs',
]);

export async function passthrough(rootDir, distDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (entry.isDirectory()) {
      if (PASSTHROUGH_DIRS.has(name)) {
        await cp(join(rootDir, name), join(distDir, name), { recursive: true });
      }
      // skip anything else
      continue;
    }
    if (EXCLUDE_FILES.has(name)) continue;
    if (!PASSTHROUGH_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    await cp(join(rootDir, name), join(distDir, name));
  }
}
```

- [ ] **Step 4: Wire passthrough into the build runner**

Modify `scripts/build.js` — add the import and call right after `ensureDir(DIST)`:

```javascript
import { passthrough } from './lib/passthrough.js';
```

Inside `main()`, after `await ensureDir(DIST);`:

```javascript
  await passthrough(ROOT, DIST);
  console.log('✓ copied legacy passthrough files');
```

The new `main()` reads:

```javascript
async function main() {
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true });
  }
  await ensureDir(DIST);

  await passthrough(ROOT, DIST);
  console.log('✓ copied legacy passthrough files');

  const shared = await loadShared();
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');

  await buildHome({ shared, layout });

  console.log('\nBuild complete.');
}
```

- [ ] **Step 5: Run the build manually**

Run: `node scripts/build.js`
Expected: Output now shows `✓ copied legacy passthrough files` before the page builds. `dist/index.html`, `dist/businesses.html`, etc. all exist.

Verify:
```bash
ls dist/
ls dist/api/
ls dist/en/
ls dist/es/
```

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass (25 prior + 2 new = 27).

- [ ] **Step 7: Commit**

```bash
git add tests/passthrough.test.js scripts/lib/passthrough.js scripts/build.js
git commit -m "feat: copy legacy HTML and assets to dist via passthrough"
```

---

## Task 9: Update Vercel config

Switch Vercel from serving the repo root to serving `dist/`, with the build run on deploy.

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Replace `vercel.json`**

Current content:
```json
{
  "cleanUrls": true
}
```

Replace with:
```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 2: Verify the build still runs locally**

Run: `npm run build`
Expected: Same successful output as before.

- [ ] **Step 3: Verify `dist/` looks right**

Run:
```bash
ls dist/en/ && ls dist/es/ && ls dist/ | head -20
```

Expected: `dist/en/index.html` exists, `dist/es/index.html` exists, top-level `dist/` contains all legacy files.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore: configure Vercel to build via npm and serve dist/"
```

---

## Task 10: Local smoke test with Vercel CLI

Confirm the built output behaves correctly when served by Vercel locally.

- [ ] **Step 1: Install Vercel CLI if not present**

Run: `vercel --version || npm install -g vercel`

- [ ] **Step 2: Start local Vercel dev**

Run (in repo root): `vercel dev`
Expected: Vercel runs `npm run build`, then starts a local server (default port 3000).

- [ ] **Step 3: Curl the new URLs**

In a separate terminal:

```bash
curl -s http://localhost:3000/en/ | grep -E '(<html lang|hreflang|<title>)' | head -10
curl -s http://localhost:3000/es/ | grep -E '(<html lang|hreflang|<title>)' | head -10
```

Expected for `/en/`:
- `<html lang="en">`
- hreflang tags for en, es, x-default
- English `<title>`

Expected for `/es/`:
- `<html lang="es-MX">`
- Same hreflang tags
- Spanish `<title>`

- [ ] **Step 4: Verify legacy URLs still work**

```bash
curl -sI http://localhost:3000/ | head -3
curl -sI http://localhost:3000/businesses | head -3
curl -sI http://localhost:3000/faq | head -3
curl -sI http://localhost:3000/tour | head -3
curl -sI http://localhost:3000/advertise | head -3
```

All should return `HTTP/1.1 200 OK`.

- [ ] **Step 5: Visual check in a browser**

Open `http://localhost:3000/en/` and `http://localhost:3000/es/` in a browser. Confirm:
- Page renders with all expected sections (hero, about, historia, events, stay, etc.)
- All visible text is in the correct language
- No visible `{{tokens}}` anywhere
- No JS console errors related to missing translations
- Existing JS features still work (mobile menu, rental popup, weather widget)

- [ ] **Step 6: Stop the dev server**

`Ctrl+C` in the terminal running `vercel dev`.

- [ ] **Step 7: No commit — this is verification only**

If anything failed, fix the underlying file (template, content, build script) and re-test before moving on.

---

## Task 11: Deploy preview to Vercel

- [ ] **Step 1: Push the branch and create a PR**

```bash
git status
git log --oneline -10
git push origin HEAD
```

> **Known issue:** Git HTTPS push has been broken on this repo. If push fails, ask the user to either set up SSH remote (`git remote set-url origin git@github.com:USER/REPO.git`) or use a personal access token. Do not attempt to fix git auth as part of this PR.

Then create the PR via `gh pr create` or GitHub UI. Title suggestion: `feat: PR 1 — bilingual build system foundation + homepage`. Body should reference the spec at `docs/superpowers/specs/2026-05-12-seo-overhaul-design.md` and this plan.

- [ ] **Step 2: Wait for Vercel preview deployment**

Vercel auto-deploys the PR branch. Find the preview URL in the GitHub PR checks or Vercel dashboard.

- [ ] **Step 3: Verify on the preview URL**

```bash
PREVIEW_URL="<paste preview URL>"
curl -s "$PREVIEW_URL/en/" | grep -E '<html lang|hreflang|<title>' | head -5
curl -s "$PREVIEW_URL/es/" | grep -E '<html lang|hreflang|<title>' | head -5
curl -sI "$PREVIEW_URL/" | head -3
curl -sI "$PREVIEW_URL/businesses" | head -3
```

Expected: same results as the local smoke test.

Open the preview URL in a browser, visit `/en/` and `/es/`, do a final visual confirmation.

- [ ] **Step 4: Hand off to user for review and merge**

Stop here. The user merges and `vercel --prod` (or auto-promote) deploys to `sanjosedegracia.net`.

---

## Self-Review checklist (run before handoff)

- [ ] Every spec section for PR 1 is covered: build system foundation ✓, content/template split ✓, homepage migrated ✓, deploys `/en/` and `/es/` alongside legacy ✓
- [ ] No "TBD," "implement later," or vague handwave steps
- [ ] Every code step contains the actual code
- [ ] Function/property names are consistent across tasks (`render`, `loadContent`, `resolveLang`, `buildPage`, `passthrough`)
- [ ] Tests precede implementation in every TDD task
- [ ] Each task ends with a commit
- [ ] The legacy site still works after the build (passthrough verifies this)

## What ships in PR 1

- Vanilla Node build system, zero runtime deps, ~5 small files in `scripts/`
- Test suite via `node:test` (27 tests)
- Bilingual homepage at `/en/` and `/es/` with correct `<html lang>`, hreflang, canonical
- Legacy URLs (`/`, `/businesses`, `/faq`, `/tour`, `/advertise`) unchanged — full passthrough
- Vercel builds on every push

## What does NOT ship in PR 1 (deferred to later PRs)

- Migration of businesses/faq/tour/advertise to bilingual URLs (PR 2)
- Sitemap split + hreflang on legacy pages (PR 3)
- `/` root-language redirect (PR 3)
- Per-business static pages (PR 4)
- Topic/tourist pages (PR 5)
- `.org` redirect, GSC Domain property (PR 6)
