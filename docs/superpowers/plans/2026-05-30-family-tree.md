# Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a private, bilingual interactive family tree on sanjosedegracia.net, seeded with the researched direct line, gated by a shared family password and hidden from search engines.

**Architecture:** Tree data lives in a committed GEDCOM-aligned `content/family/tree.json`, read **server-side** by a Vercel function (never inlined into static HTML, so it is unscrapable without the password). A new static page renders a login shell + tree canvas; after the family password is accepted, client JS fetches the data from a cookie-gated endpoint and draws a vertical pedigree with a click-to-open detail drawer. The page is `noindex` and excluded from sitemap/robots.

**Tech Stack:** Node 20 ESM, the repo's existing static build (`scripts/build.js` + `{{token}}` render + `content/pages/*.json` + `templates/pages/*.html`), Vercel serverless functions (`api/*.js`), Node `crypto` for cookie signing, `node --test` for tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-30-family-tree-design.md`
**Branch:** `feature/family-tree`

---

## File Structure

**Create:**
- `content/family/tree.json` — GEDCOM-aligned individuals + families data (committed; read server-side only).
- `scripts/lib/family-tree.js` — `validateTree(data)` schema/referential-integrity validator (shared by build + API + tests).
- `content/pages/family.json` — page meta (slugs `family`/`familia`, `meta.robots: "noindex, nofollow"`) + bilingual UI strings.
- `templates/pages/family.html` — login shell + tree canvas container + client script tag.
- `public/family-tree.js` *(passthrough static asset)* — client-side renderer (pedigree layout, drawer, zoom/pan, auth flow).
- `api/family-auth.js` — POST password → signed HttpOnly cookie.
- `api/family-tree.js` — GET → validates cookie → returns `tree.json` (else 401).
- `scripts/lib/family-cookie.js` — shared `signToken()` / `verifyToken()` HMAC helpers (used by both API functions + tests).
- Tests: `tests/family-tree-data.test.js`, `tests/family-cookie.test.js`, `tests/family-page-build.test.js`, `tests/meta-robots.test.js`, `tests/family-layout.test.js`.

**Modify:**
- `scripts/lib/build-page.js` — default `meta.robots` so the new `{{meta.robots}}` token never throws on existing pages.
- `templates/layouts/base.html` — add `<meta name="robots" content="{{meta.robots}}" />` to `<head>`.
- `content/shared/page-slugs.json` — add the `family` entry.
- `robots.txt` — `Disallow` the family/familia paths.
- `vercel.json` — register the two new functions (and a passthrough note if needed).

> **Note on passthrough:** `scripts/build.js` calls `passthrough(ROOT, DIST)` to copy legacy root files. Confirm in Task 0 how passthrough selects files; place `family-tree.js` wherever passthrough already copies static JS (root or `public/`). The plan assumes root-level passthrough like the existing favicons; adjust the path in Task 9 if Task 0 shows otherwise.

---

## PR 1 — Data model + validator

### Task 0: Confirm passthrough behavior

- [ ] **Step 1: Read the passthrough source**

Run: `cat scripts/lib/passthrough.js`
Expected: see which root files/extensions get copied to `dist/`. Note whether arbitrary `.js` files at repo root are copied, or only an allowlist. Record the correct location for `family-tree.js` and use it consistently in Task 9. If passthrough uses an allowlist, add `family-tree.js` to it in Task 9.

### Task 1: Tree data validator

**Files:**
- Create: `scripts/lib/family-tree.js`
- Test: `tests/family-tree-data.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/family-tree-data.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTree } from '../scripts/lib/family-tree.js';

const ok = {
  individuals: [
    { id: 'I1', names: { given: 'Jaime', surnames: ['Murillo', 'Mena'] }, sex: 'M',
      birth: { date: null, place: null }, death: { date: null, place: null },
      photo: null, surnameOrigin: null, recordLinks: [], notes: { en: '', es: '' } },
    { id: 'I2', names: { given: 'José', surnames: ['Murillo', 'Villalobos'] }, sex: 'M',
      birth: { date: null, place: 'San José de Gracia, Jalisco' }, death: { date: null, place: null },
      photo: null, surnameOrigin: { text: 'Murillo — toponímico', confidence: 'high' },
      recordLinks: [{ label: 'Tepatitlán', url: 'https://example.org' }], notes: { en: '', es: '' } },
  ],
  families: [{ id: 'F1', husband: 'I2', wife: null, children: ['I1'] }],
};

test('accepts a well-formed tree', () => {
  assert.deepEqual(validateTree(ok), { valid: true, errors: [] });
});

test('rejects duplicate individual ids', () => {
  const bad = structuredClone(ok);
  bad.individuals[1].id = 'I1';
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /duplicate individual id: I1/i);
});

test('rejects a family referencing an unknown individual', () => {
  const bad = structuredClone(ok);
  bad.families[0].children = ['I999'];
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /family F1 references unknown individual: I999/i);
});

test('rejects an individual missing a given name', () => {
  const bad = structuredClone(ok);
  delete bad.individuals[0].names.given;
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /individual I1 missing names\.given/i);
});

test('rejects an invalid surnameOrigin confidence', () => {
  const bad = structuredClone(ok);
  bad.individuals[1].surnameOrigin.confidence = 'maybe';
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /individual I2 surnameOrigin\.confidence must be one of/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-tree-data.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/family-tree.js'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/lib/family-tree.js
const CONFIDENCE = new Set(['high', 'medium', 'low']);

export function validateTree(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['tree must be an object'] };
  const individuals = Array.isArray(data.individuals) ? data.individuals : null;
  const families = Array.isArray(data.families) ? data.families : null;
  if (!individuals) errors.push('individuals must be an array');
  if (!families) errors.push('families must be an array');
  if (!individuals || !families) return { valid: false, errors };

  const ids = new Set();
  for (const ind of individuals) {
    if (!ind || typeof ind.id !== 'string') { errors.push('every individual needs a string id'); continue; }
    if (ids.has(ind.id)) errors.push(`duplicate individual id: ${ind.id}`);
    ids.add(ind.id);
    if (!ind.names || typeof ind.names.given !== 'string') errors.push(`individual ${ind.id} missing names.given`);
    if (!ind.names || !Array.isArray(ind.names.surnames)) errors.push(`individual ${ind.id} missing names.surnames[]`);
    if (ind.surnameOrigin && !CONFIDENCE.has(ind.surnameOrigin.confidence)) {
      errors.push(`individual ${ind.id} surnameOrigin.confidence must be one of high|medium|low`);
    }
  }

  for (const fam of families) {
    if (!fam || typeof fam.id !== 'string') { errors.push('every family needs a string id'); continue; }
    const refs = [fam.husband, fam.wife, ...(Array.isArray(fam.children) ? fam.children : [])].filter(Boolean);
    for (const ref of refs) {
      if (!ids.has(ref)) errors.push(`family ${fam.id} references unknown individual: ${ref}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-tree-data.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/family-tree.js tests/family-tree-data.test.js
git commit -m "feat: family tree data validator (GEDCOM-aligned schema)"
```

### Task 2: Seed data file

**Files:**
- Create: `content/family/tree.json`
- Test: extend `tests/family-tree-data.test.js`

- [ ] **Step 1: Write the failing test (seed file is valid)**

Append to `tests/family-tree-data.test.js`:

```javascript
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

test('the committed seed tree.json is valid', async () => {
  const raw = await readFile(join(__dirname, '../content/family/tree.json'), 'utf8');
  const res = validateTree(JSON.parse(raw));
  assert.deepEqual(res, { valid: true, errors: [] });
});

test('seed contains the eight researched surnames somewhere', async () => {
  const raw = await readFile(join(__dirname, '../content/family/tree.json'), 'utf8');
  const all = JSON.parse(raw).individuals.flatMap(i => i.names.surnames);
  for (const s of ['Murillo','Mena','Ruiz','Patiño','Villalobos','Gutiérrez','Sánchez','Hernández']) {
    assert.ok(all.includes(s), `missing surname ${s}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-tree-data.test.js`
Expected: FAIL — `ENOENT ... content/family/tree.json`.

- [ ] **Step 3: Create the seed file**

```json
{
  "individuals": [
    { "id": "I1", "names": { "given": "Jaime", "surnames": ["Murillo", "Mena"] }, "sex": "M", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": null, "recordLinks": [], "notes": { "en": "", "es": "" } },
    { "id": "I2", "names": { "given": "Héctor", "surnames": ["Murillo", "Patiño"] }, "sex": "M", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": null, "recordLinks": [], "notes": { "en": "", "es": "" } },
    { "id": "I3", "names": { "given": "Mercedes", "surnames": ["Mena", "Ruiz"] }, "sex": "F", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": null, "recordLinks": [], "notes": { "en": "", "es": "" } },
    { "id": "I4", "names": { "given": "José", "surnames": ["Murillo", "Villalobos"] }, "sex": "M", "birth": { "date": null, "place": "San José de Gracia, Jalisco" }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": { "text": "Murillo — toponímico, del latín murellus (\"pequeña muralla\"). Navarra/La Rioja.", "confidence": "high" }, "recordLinks": [{ "label": "Tepatitlán · San Francisco de Asís (1666–1957)", "url": "https://www.familysearch.org/en/wiki/Tepatitl%C3%A1n_de_Morelos,_Altos_Sur,_Jalisco,_Mexico_Genealogy" }], "notes": { "en": "Murillo line of San José de Gracia.", "es": "Línea Murillo de San José de Gracia." } },
    { "id": "I5", "names": { "given": "Teresa", "surnames": ["Patiño", "Gutiérrez"] }, "sex": "F", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": { "text": "Patiño — gallego, diminutivo de pato. Gutiérrez — patronímico documentado entre las familias fundadoras de Los Altos.", "confidence": "high" }, "recordLinks": [], "notes": { "en": "", "es": "" } },
    { "id": "I6", "names": { "given": "Benjamín", "surnames": ["Mena", "Sánchez"] }, "sex": "M", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": { "text": "Mena — toponímico (Valle de Mena, Burgos). Sánchez — patronímico (\"hijo de Sancho\").", "confidence": "high" }, "recordLinks": [], "notes": { "en": "", "es": "" } },
    { "id": "I7", "names": { "given": "María del Refugio", "surnames": ["Ruiz", "Hernández"] }, "sex": "F", "birth": { "date": null, "place": null }, "death": { "date": null, "place": null }, "photo": null, "surnameOrigin": { "text": "Ruiz — patronímico (\"hijo de Ruy/Rodrigo\"). Hernández — patronímico (\"hijo de Hernando\").", "confidence": "high" }, "recordLinks": [], "notes": { "en": "", "es": "" } }
  ],
  "families": [
    { "id": "F1", "husband": "I2", "wife": "I3", "children": ["I1"] },
    { "id": "F2", "husband": "I4", "wife": "I5", "children": ["I2"] },
    { "id": "F3", "husband": "I6", "wife": "I7", "children": ["I3"] }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-tree-data.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add content/family/tree.json tests/family-tree-data.test.js
git commit -m "feat: seed family tree with researched direct line + surname origins"
```

---

## PR 2 — noindex plumbing (search-engine hiding)

### Task 3: Default `meta.robots` in the page builder

**Files:**
- Modify: `scripts/lib/build-page.js`
- Test: `tests/meta-robots.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/meta-robots.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/meta-robots.test.js`
Expected: FAIL — `unresolved token: meta.robots` (default case throws).

- [ ] **Step 3: Implement the default**

In `scripts/lib/build-page.js`, inside `buildPage`, after `const ctx = { ... }` is constructed, add before the render calls:

```javascript
  // Pages are indexable by default; private pages set meta.robots to "noindex, nofollow".
  ctx.meta = { ...ctx.meta, robots: ctx.meta.robots ?? 'index, follow' };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/meta-robots.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/build-page.js tests/meta-robots.test.js
git commit -m "feat: default meta.robots to index,follow (enables per-page noindex)"
```

### Task 4: Add the robots meta tag to the base layout

**Files:**
- Modify: `templates/layouts/base.html`

- [ ] **Step 1: Add the tag**

In `templates/layouts/base.html`, immediately after the `<link rel="canonical" ... />` line (currently line ~59), add:

```html
  <meta name="robots" content="{{meta.robots}}" />
```

- [ ] **Step 2: Verify the full build still works**

Run: `npm run build && npm test`
Expected: build completes; all existing tests still PASS (existing pages now emit `content="index, follow"` via the Task 3 default).

- [ ] **Step 3: Commit**

```bash
git add templates/layouts/base.html
git commit -m "feat: emit robots meta tag in base layout"
```

### Task 5: Disallow the family paths in robots.txt

**Files:**
- Modify: `robots.txt`

- [ ] **Step 1: Edit robots.txt**

Replace the contents of `robots.txt` with:

```
User-agent: *
Allow: /
Disallow: /en/family
Disallow: /es/familia

Sitemap: https://sanjosedegracia.net/sitemap.xml
```

- [ ] **Step 2: Confirm the family page is NOT added to sitemap.xml**

Run: `grep -c "family\|familia" sitemap.xml`
Expected: `0` (sitemap.xml is a committed passthrough file; the family page must never be added to it).

- [ ] **Step 3: Commit**

```bash
git add robots.txt
git commit -m "feat: disallow private family tree paths in robots.txt"
```

---

## PR 3 — The family page (login shell)

### Task 6: Page content JSON

**Files:**
- Create: `content/pages/family.json`

- [ ] **Step 1: Create the content file**

```json
{
  "meta": {
    "slug":        { "en": "family", "es": "familia" },
    "title":       { "en": "Family Tree (Private)", "es": "Árbol Genealógico (Privado)" },
    "description": { "en": "Private family tree.", "es": "Árbol genealógico privado." },
    "robots":      { "en": "noindex, nofollow", "es": "noindex, nofollow" },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "ui": {
    "heading":        { "en": "Murillo · Mena Family Tree", "es": "Árbol Genealógico Murillo · Mena" },
    "login_prompt":   { "en": "This page is private. Enter the family password.", "es": "Esta página es privada. Ingresa la contraseña familiar." },
    "password_label": { "en": "Family password", "es": "Contraseña familiar" },
    "enter":          { "en": "Enter", "es": "Entrar" },
    "wrong":          { "en": "Incorrect password.", "es": "Contraseña incorrecta." }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add content/pages/family.json
git commit -m "feat: family page content (noindex meta + bilingual UI strings)"
```

### Task 7: Register the page slug

**Files:**
- Modify: `content/shared/page-slugs.json`

- [ ] **Step 1: Add the family entry**

Add this line to `content/shared/page-slugs.json` (after the `"festivals"` line, with a preceding comma on the festivals line):

```json
  "family":        { "en": "family",        "es": "familia" }
```

- [ ] **Step 2: Confirm it is NOT referenced in nav**

Run: `grep -c "family\|familia" content/shared/nav.json`
Expected: `0` (the page must not appear in public navigation).

- [ ] **Step 3: Commit**

```bash
git add content/shared/page-slugs.json
git commit -m "feat: register private family page slug (family/familia)"
```

### Task 8: Page template + build test

**Files:**
- Create: `templates/pages/family.html`
- Test: `tests/family-page-build.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/family-page-build.test.js
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
  assert.doesNotMatch(html, /\{\{.*?\}\}/); // no unresolved tokens
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-page-build.test.js`
Expected: FAIL — `ENOENT ... templates/pages/family.html`.

- [ ] **Step 3: Create the template**

```html
<!-- templates/pages/family.html -->
<style>
  .ft-wrap { max-width: 1100px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .ft-wrap h1 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(1.8rem,4vw,2.6rem); margin-bottom: 1.5rem; }
  #ft-login { max-width: 360px; margin: 2rem auto; text-align: center; }
  #ft-login input { width: 100%; padding: .7rem; margin: .6rem 0; border: 1px solid var(--mist); border-radius: 6px; }
  #ft-login button { padding: .6rem 1.4rem; border: none; border-radius: 6px; background: var(--clay); color: #fff; cursor: pointer; }
  #ft-error { color: #b00; font-size: .9rem; min-height: 1.2em; }
  #ft-canvas { display: none; width: 100%; height: 70vh; border: 1px solid var(--mist); border-radius: 8px; overflow: hidden; position: relative; }
</style>

<div class="ft-wrap">
  <h1>{{ui.heading}}</h1>

  <div id="ft-login">
    <p>{{ui.login_prompt}}</p>
    <input id="ft-password" type="password" aria-label="{{ui.password_label}}" autocomplete="current-password" />
    <div id="ft-error" data-wrong="{{ui.wrong}}"></div>
    <button id="ft-enter">{{ui.enter}}</button>
  </div>

  <div id="ft-canvas" data-lang="{{lang}}"></div>
</div>

<script src="/family-tree.js" defer></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-page-build.test.js`
Expected: PASS.

- [ ] **Step 5: Full build check**

Run: `npm run build`
Expected: log includes `✓ wrote dist/en/family.html` and `✓ wrote dist/es/familia.html`.

- [ ] **Step 6: Commit**

```bash
git add templates/pages/family.html tests/family-page-build.test.js
git commit -m "feat: family page template (login shell + tree canvas)"
```

---

## PR 4 — Auth + cookie-gated data API

### Task 9: Cookie signing helper

**Files:**
- Create: `scripts/lib/family-cookie.js`
- Test: `tests/family-cookie.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/family-cookie.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../scripts/lib/family-cookie.js';

const SECRET = 'test-secret';

test('a freshly signed token verifies', () => {
  const t = signToken({ secret: SECRET, ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 2000 }), true);
});

test('a tampered token fails verification', () => {
  const t = signToken({ secret: SECRET, ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t + 'x', secret: SECRET, nowMs: 2000 }), false);
});

test('a token signed with a different secret fails', () => {
  const t = signToken({ secret: 'other', ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 2000 }), false);
});

test('an expired token fails', () => {
  const t = signToken({ secret: SECRET, ttlMs: 1000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 5000 }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-cookie.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/family-cookie.js'`.

- [ ] **Step 3: Implement the helper**

```javascript
// scripts/lib/family-cookie.js
import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

// token = "<expiresAtMs>.<hmac>"
export function signToken({ secret, ttlMs, nowMs }) {
  const expiresAt = nowMs + ttlMs;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken({ token, secret, nowMs }) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && nowMs < expiresAt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-cookie.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/family-cookie.js tests/family-cookie.test.js
git commit -m "feat: HMAC-signed family auth cookie helper (TTL + tamper-proof)"
```

### Task 10: Auth endpoint

**Files:**
- Create: `api/family-auth.js`

- [ ] **Step 1: Implement (follows the api/blocked-places.js handler pattern)**

```javascript
// api/family-auth.js
import { signToken } from '../scripts/lib/family-cookie.js';

const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET   = process.env.FAMILY_TREE_SECRET   || PASSWORD;
const TTL_MS   = 1000 * 60 * 60 * 24 * 30; // 30 days
const COOKIE   = 'ft_auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password } = req.body || {};
  if (typeof password !== 'string' || password !== PASSWORD) {
    return res.status(401).json({ ok: false });
  }
  const token = signToken({ secret: SECRET, ttlMs: TTL_MS, nowMs: Date.now() });
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`);
  return res.json({ ok: true });
}
```

- [ ] **Step 2: Sanity-check it imports without crashing**

Run: `node -e "import('./api/family-auth.js').then(()=>console.log('ok'))"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add api/family-auth.js
git commit -m "feat: family-auth endpoint (password -> signed HttpOnly cookie)"
```

### Task 11: Cookie-gated data endpoint

**Files:**
- Create: `api/family-tree.js`

- [ ] **Step 1: Implement**

```javascript
// api/family-tree.js
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from '../scripts/lib/family-cookie.js';

const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET   = process.env.FAMILY_TREE_SECRET   || PASSWORD;
const COOKIE   = 'ft_auth';
const __dirname = dirname(fileURLToPath(import.meta.url));

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = readCookie(req, COOKIE);
  if (!verifyToken({ token, secret: SECRET, nowMs: Date.now() })) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const data = await readFile(join(__dirname, '../content/family/tree.json'), 'utf8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(data);
}
```

- [ ] **Step 2: Sanity-check import**

Run: `node -e "import('./api/family-tree.js').then(()=>console.log('ok'))"`
Expected: prints `ok`.

- [ ] **Step 3: Register both functions in vercel.json**

In `vercel.json`, under `"functions"`, add entries alongside the existing `api/refresh-businesses.js`:

```json
    "api/family-auth.js": { "maxDuration": 10 },
    "api/family-tree.js": { "maxDuration": 10 }
```

- [ ] **Step 4: Commit**

```bash
git add api/family-tree.js vercel.json
git commit -m "feat: cookie-gated family-tree data endpoint (401 without valid cookie)"
```

---

## PR 5 — Interactive front-end

### Task 12: Pedigree layout function (pure, testable)

**Files:**
- Create: `scripts/lib/family-layout.js`
- Test: `tests/family-layout.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/family-layout.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGenerations } from '../scripts/lib/family-layout.js';

const tree = {
  individuals: [{ id: 'I1' }, { id: 'I2' }, { id: 'I3' }, { id: 'I4' }, { id: 'I5' }],
  families: [
    { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
    { id: 'F2', husband: 'I4', wife: 'I5', children: ['I2'] },
  ],
};

test('root (no parents) is generation 0', () => {
  const gens = computeGenerations(tree, 'I1');
  assert.equal(gens.get('I1'), 0);
});

test('parents are generation 1, grandparents generation 2', () => {
  const gens = computeGenerations(tree, 'I1');
  assert.equal(gens.get('I2'), 1);
  assert.equal(gens.get('I3'), 1);
  assert.equal(gens.get('I4'), 2);
  assert.equal(gens.get('I5'), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-layout.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```javascript
// scripts/lib/family-layout.js
// Returns Map<individualId, generationDepth> where the root is 0 and each
// ancestor generation increments by 1. Used to place rows in the pedigree.
export function computeGenerations(tree, rootId) {
  const childToParents = new Map();
  for (const fam of tree.families) {
    const parents = [fam.husband, fam.wife].filter(Boolean);
    for (const child of (fam.children || [])) {
      childToParents.set(child, (childToParents.get(child) || []).concat(parents));
    }
  }
  const gens = new Map();
  const walk = (id, depth) => {
    if (!gens.has(id) || depth > gens.get(id)) gens.set(id, depth);
    for (const parent of (childToParents.get(id) || [])) walk(parent, depth + 1);
  };
  walk(rootId, 0);
  return gens;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-layout.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/family-layout.js tests/family-layout.test.js
git commit -m "feat: pure pedigree generation-depth layout function"
```

### Task 13: Client renderer (auth flow + draw + drawer)

**Files:**
- Create: `family-tree.js` (repo root, or the passthrough location confirmed in Task 0)

- [ ] **Step 1: Implement the client script**

```javascript
// family-tree.js — served statically, runs on /en/family and /es/familia
(function () {
  const login = document.getElementById('ft-login');
  const canvas = document.getElementById('ft-canvas');
  const pwInput = document.getElementById('ft-password');
  const enterBtn = document.getElementById('ft-enter');
  const errEl = document.getElementById('ft-error');
  if (!login || !canvas) return;
  const lang = canvas.getAttribute('data-lang') || 'en';

  async function tryLoad() {
    const res = await fetch('/api/family-tree', { credentials: 'same-origin' });
    if (res.status === 200) {
      const tree = await res.json();
      login.style.display = 'none';
      canvas.style.display = 'block';
      draw(tree);
      return true;
    }
    return false;
  }

  async function submit() {
    errEl.textContent = '';
    const res = await fetch('/api/family-auth', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput.value }),
    });
    if (res.ok) { await tryLoad(); }
    else { errEl.textContent = errEl.getAttribute('data-wrong'); }
  }

  enterBtn.addEventListener('click', submit);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  function nameOf(ind) { return ind.names.given + ' ' + ind.names.surnames.join(' '); }

  function draw(tree) {
    // Vertical pedigree: group individuals by generation depth from the first
    // individual (the root / "you"), render each generation as a row, newest at
    // the bottom. Click a node to open the detail drawer.
    const childToParents = new Map();
    for (const fam of tree.families) {
      const parents = [fam.husband, fam.wife].filter(Boolean);
      for (const c of (fam.children || [])) childToParents.set(c, (childToParents.get(c) || []).concat(parents));
    }
    const byId = new Map(tree.individuals.map(i => [i.id, i]));
    const gens = new Map();
    (function walk(id, d) {
      if (!gens.has(id) || d > gens.get(id)) gens.set(id, d);
      for (const p of (childToParents.get(id) || [])) walk(p, d + 1);
    })(tree.individuals[0].id, 0);

    const maxGen = Math.max(...gens.values());
    const rows = Array.from({ length: maxGen + 1 }, () => []);
    for (const [id, g] of gens) rows[g].push(byId.get(id));

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column-reverse;gap:28px;padding:28px;align-items:center;';
    rows.forEach(row => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:18px;justify-content:center;flex-wrap:wrap;';
      row.forEach(ind => r.appendChild(nodeEl(ind)));
      wrap.appendChild(r);
    });
    canvas.innerHTML = '';
    canvas.appendChild(wrap);
    enableZoomPan(canvas, wrap);
  }

  function nodeEl(ind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.style.cssText = 'display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #d9c9b0;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;text-align:left;';
    const initials = (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    el.innerHTML = '<span style="width:40px;height:40px;border-radius:50%;background:#6b4f2e;color:#f4e9d8;display:flex;align-items:center;justify-content:center;font-weight:600;">' + initials + '</span>' +
      '<span><strong style="font-size:.9rem;">' + nameOf(ind) + '</strong></span>';
    el.addEventListener('click', () => openDrawer(ind));
    return el;
  }

  function openDrawer(ind) {
    let d = document.getElementById('ft-drawer');
    if (!d) {
      d = document.createElement('div');
      d.id = 'ft-drawer';
      d.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:min(380px,90vw);background:#fffdf8;box-shadow:-4px 0 24px rgba(0,0,0,.18);padding:24px;overflow:auto;z-index:50;';
      document.body.appendChild(d);
    }
    const o = ind.surnameOrigin;
    const recs = (ind.recordLinks || []).map(r => '<li><a href="' + r.url + '" target="_blank" rel="noopener">' + r.label + '</a></li>').join('');
    d.innerHTML =
      '<button id="ft-close" style="float:right;border:none;background:none;font-size:1.4rem;cursor:pointer;">×</button>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;">' + nameOf(ind) + '</h2>' +
      '<p><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && ind.birth.place) || '—') + '</p>' +
      (o ? '<p style="background:#f7eecf;border-left:3px solid #c4785a;padding:8px 10px;border-radius:0 6px 6px 0;"><strong>' + (lang === 'es' ? 'Origen del apellido' : 'Surname origin') + ':</strong> ' + o.text + ' <em>(' + o.confidence + ')</em></p>' : '') +
      (recs ? '<h3 style="font-size:.8rem;text-transform:uppercase;opacity:.6;">' + (lang === 'es' ? 'Registros' : 'Records') + '</h3><ul>' + recs + '</ul>' : '') +
      ((ind.notes && ind.notes[lang]) ? '<p>' + ind.notes[lang] + '</p>' : '');
    d.style.display = 'block';
    document.getElementById('ft-close').addEventListener('click', () => { d.style.display = 'none'; });
  }

  function enableZoomPan(container, target) {
    let scale = 1, x = 0, y = 0, dragging = false, sx = 0, sy = 0;
    const apply = () => { target.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; };
    container.addEventListener('wheel', (e) => { e.preventDefault(); scale = Math.min(2.5, Math.max(0.4, scale - e.deltaY * 0.001)); apply(); }, { passive: false });
    container.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - x; sy = e.clientY - y; });
    window.addEventListener('pointermove', (e) => { if (!dragging) return; x = e.clientX - sx; y = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { dragging = false; });
  }

  // If the family already has a valid cookie, skip the login form.
  tryLoad();
})();
```

- [ ] **Step 2: If Task 0 showed an allowlist, register the asset**

Only if `scripts/lib/passthrough.js` uses an allowlist: add `family-tree.js` to it. Otherwise (root files copied automatically) no change needed.

- [ ] **Step 3: Build and confirm the asset ships**

Run: `npm run build && ls dist/family-tree.js`
Expected: `dist/family-tree.js` exists.

- [ ] **Step 4: Commit**

```bash
git add family-tree.js scripts/lib/passthrough.js
git commit -m "feat: interactive family tree client (auth flow, pedigree, drawer, zoom/pan)"
```

### Task 14: Local end-to-end smoke check

- [ ] **Step 1: Set env and run the build + full test suite**

Run: `FAMILY_TREE_PASSWORD=testpass FAMILY_TREE_SECRET=testsecret npm run build && npm test`
Expected: build emits `dist/en/family.html`, `dist/es/familia.html`, `dist/family-tree.js`; all tests PASS.

- [ ] **Step 2: Manual verification note (for the reviewer)**

Document in the PR description: deploy to a Vercel preview, set `FAMILY_TREE_PASSWORD` and `FAMILY_TREE_SECRET` env vars in the Vercel project, visit `/es/familia`, confirm: (a) wrong password shows the error, (b) correct password reveals the tree, (c) `/api/family-tree` returns 401 in a fresh incognito session with no cookie, (d) `view-source` of the page contains no individual names (data is not inlined), (e) the page has `<meta name="robots" content="noindex, nofollow">`.

- [ ] **Step 3: Final commit (if any doc/PR notes added)**

```bash
git add -A
git commit -m "docs: family tree PR verification checklist" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- Architecture B (Notion→JSON→render): tree.json (Task 2) + server-side read (Task 11). ✓ *(Notion authoring is a manual pre-step / Future-PR concern; the repo deliverable is the JSON.)*
- GEDCOM-aligned model: Task 1–2 (individuals/families). ✓
- Vertical pedigree + drawer + zoom/pan: Tasks 12–13. ✓
- Side drawer (mobile sheet): Task 13 drawer is width `min(380px,90vw)` → near-full-screen on phones. ✓
- Shared password + noindex + sitemap/robots: Tasks 3–5, 9–11. ✓
- Bilingual EN/ES: family.json `ui` strings + `data-lang` propagation. ✓
- Tests per repo convention: every PR has `node --test` files. ✓
- `viewMode`/radial deferred: not built (correct — Future PR). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. Task 0 and Task 13/Step 2 are explicit conditionals (passthrough shape), not placeholders — they resolve to a concrete action either way.

**Type consistency:** `validateTree` shape (individuals/families, names.given/surnames, surnameOrigin.confidence) is consistent across Tasks 1, 2, 11, 12, 13. `signToken`/`verifyToken` signatures match across Tasks 9, 10, 11. Cookie name `ft_auth` consistent (Tasks 10, 11). Element ids `ft-login`/`ft-canvas`/`ft-password`/`ft-enter`/`ft-error` consistent across Tasks 8 and 13.

## Out of scope (Future PRs)
Radial poster view (`viewMode` toggle); FamilySearch GEDCOM import; 23andMe integration (needs its own privacy review). Notion authoring DB is the manual upstream workshop, not a code deliverable here.
