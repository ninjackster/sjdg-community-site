# Collective History — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen La Crónica with cited sources + the Battle of Tepatitlán, add a chronological timeline, and establish a bilingual "Story" data model (validator + featured strip) as the foundation for later phases.

**Architecture:** Content lives in `content/pages/history.json` (bilingual `{en,es}` leaves) rendered by the flat `{{token}}` engine (`scripts/lib/render.js`, no loops). Lists are therefore **pre-rendered to HTML strings** by pure helpers and injected as `{en,es}` content fields in `buildOnePage` (mirroring the existing `businesses` augmentation), exactly like the hand-authored `sources.body`. Pure helpers are unit-tested; the built page is asserted in `tests/history-page.test.js`.

**Tech Stack:** Node ESM, the project's custom static-site builder (`scripts/build.js` → `buildPage` → `render`), `node --test`. No new runtime/browser dependency.

**Spec:** `docs/superpowers/specs/2026-06-02-collective-history-design.md` · **Research:** `docs/superpowers/research/2026-06-02-sjdg-history-dossier.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `scripts/lib/history-render.js` | Pure HTML renderers: `renderTimeline(timeline, lang)`, `renderHistorias(stories, lang)`; shared `esc()`. | **Create** |
| `scripts/lib/history-stories.js` | Pure `validateStories(data)` (ids, kinds, bilingual fields, coords). | **Create** |
| `content/history/stories.json` | Seed Stories (the atom) `{ stories:[…] }`. | **Create** |
| `content/pages/history.json` | Add `timeline` block; real `sources.body`; soften 4 claims; add Battle of Tepatitlán to `cristero.body`. | **Modify** |
| `templates/pages/history.html` | Add `.cr-timeline` + `.cr-historias` sections + their CSS. | **Modify** |
| `scripts/build.js` | In `buildOnePage`, for `pageName==='history'`: validate stories, inject `timeline.body` + `historias.body` as `{en,es}`. | **Modify (~line 78–87 area)** |
| `tests/history-render.test.js` | Unit tests for `renderTimeline` / `renderHistorias`. | **Create** |
| `tests/history-stories.test.js` | Unit tests for `validateStories`. | **Create** |
| `tests/history-page.test.js` | Extend: timeline + historias + Battle + sources count render in the built page. | **Modify** |

---

## Task 1: Timeline renderer (`renderTimeline`)

**Files:** Create `scripts/lib/history-render.js`, `tests/history-render.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/history-render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTimeline } from '../scripts/lib/history-render.js';

const timeline = () => ({
  heading: { en: 'Timeline', es: 'Línea del tiempo' },
  entries: [
    { year: '1824', label: { en: 'Tepatitlán a villa', es: 'Tepatitlán a villa' } },
    { year: '1926–29', label: { en: 'Cristero War <b>region</b>', es: 'Guerra Cristera' } },
  ],
});

test('renderTimeline: heading + entries in order, year + label', () => {
  const html = renderTimeline(timeline(), 'en');
  assert.match(html, /Timeline/);
  assert.ok(html.indexOf('1824') < html.indexOf('1926'), 'entries keep order');
  assert.match(html, /<ol class="cr-tl">/);
  assert.equal((html.match(/<li/g) || []).length, 2);
});

test('renderTimeline: localized + HTML-escaped labels', () => {
  const es = renderTimeline(timeline(), 'es');
  assert.match(es, /Guerra Cristera/);
  assert.match(es, /Línea del tiempo/);
  // labels are escaped (no raw <b>)
  assert.doesNotMatch(renderTimeline(timeline(), 'en'), /<b>region<\/b>/);
  assert.match(renderTimeline(timeline(), 'en'), /&lt;b&gt;region&lt;\/b&gt;/);
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test tests/history-render.test.js` → FAIL (`Cannot find module '../scripts/lib/history-render.js'`).

- [ ] **Step 3: Write minimal implementation** — create `scripts/lib/history-render.js`:

```js
// Pure HTML renderers for the history page. The site's template engine does flat
// {{token}} replacement only (no loops), so lists are pre-rendered to HTML strings
// here and injected as {en,es} content fields by the build (see scripts/build.js).

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTimeline(timeline, lang) {
  const heading = (timeline.heading && timeline.heading[lang]) || '';
  const items = (timeline.entries || []).map(e =>
    '<li><span class="cr-tl-year">' + esc(e.year) + '</span>' +
    '<span class="cr-tl-label">' + esc(e.label && e.label[lang]) + '</span></li>'
  ).join('');
  return '<h2>' + esc(heading) + '</h2><ol class="cr-tl">' + items + '</ol>';
}
```

- [ ] **Step 4: Run test to verify it passes** — `node --test tests/history-render.test.js` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/history-render.js tests/history-render.test.js
git commit -m "feat(history): pure renderTimeline helper"
```

---

## Task 2: Story validator + `renderHistorias` + seed stories

**Files:** Create `scripts/lib/history-stories.js`, `content/history/stories.json`, `tests/history-stories.test.js`; Modify `scripts/lib/history-render.js`, `tests/history-render.test.js`

- [ ] **Step 1: Write the failing validator test** — create `tests/history-stories.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStories } from '../scripts/lib/history-stories.js';

const story = (over = {}) => ({
  id: 's1', kind: 'event',
  title: { en: 'T', es: 'T' }, body: { en: 'B', es: 'B' }, ...over,
});

test('valid set passes', () => {
  const r = validateStories({ stories: [story(), story({ id: 's2' })] });
  assert.equal(r.valid, true);
});

test('duplicate id fails', () => {
  const r = validateStories({ stories: [story(), story()] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /duplicate id/i);
});

test('missing bilingual field fails', () => {
  const r = validateStories({ stories: [story({ title: { en: 'only' } })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /title/);
});

test('bad kind fails', () => {
  const r = validateStories({ stories: [story({ kind: 'nope' })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /kind/);
});

test('non-numeric place coords fail', () => {
  const r = validateStories({ stories: [story({ place: { name: 'X', lat: 'a', lng: 1 } })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /coord/i);
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test tests/history-stories.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement the validator** — create `scripts/lib/history-stories.js`:

```js
// Pure validator for history "Story" atoms. Mirrors the family-tree validateTree discipline.
const KINDS = new Set(['place', 'person', 'object', 'event']);
const bilingual = (v) => v && typeof v === 'object' && typeof v.en === 'string' && typeof v.es === 'string';

export function validateStories(data) {
  const errors = [];
  const stories = (data && Array.isArray(data.stories)) ? data.stories : null;
  if (!stories) return { valid: false, errors: ['stories must be an array'] };
  const seen = new Set();
  for (const s of stories) {
    const id = s && s.id;
    if (!id || typeof id !== 'string') { errors.push('story missing string id'); continue; }
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
    if (!KINDS.has(s.kind)) errors.push(`${id}: invalid kind "${s.kind}"`);
    if (!bilingual(s.title)) errors.push(`${id}: title must have en+es`);
    if (!bilingual(s.body)) errors.push(`${id}: body must have en+es`);
    if (s.place) {
      if (typeof s.place.lat !== 'number' || typeof s.place.lng !== 'number') errors.push(`${id}: place coords must be numbers`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run validator test** — `node --test tests/history-stories.test.js` → PASS (5 tests).

- [ ] **Step 5: Add the `renderHistorias` test** — append to `tests/history-render.test.js`:

```js
import { renderHistorias } from '../scripts/lib/history-render.js';

const stories = () => ({
  heading: { en: 'Stories', es: 'Historias' },
  stories: [
    { id: 's1', kind: 'event', title: { en: 'Battle', es: 'Batalla' }, body: { en: 'In 1929…', es: 'En 1929…' } },
    { id: 's2', kind: 'person', title: { en: 'Toribio', es: 'Toribio' }, body: { en: 'Patron', es: 'Patrón' } },
  ],
});

test('renderHistorias: heading + one card per story, localized, kind chip', () => {
  const html = renderHistorias(stories(), 'es');
  assert.match(html, /Historias/);
  assert.equal((html.match(/class="cr-story"/g) || []).length, 2);
  assert.match(html, /Batalla/);
  assert.match(html, /person|event/); // kind rendered
});
```

- [ ] **Step 6: Run it to confirm it fails** — `node --test tests/history-render.test.js` → the new test FAILS (`renderHistorias` is not exported).

- [ ] **Step 7: Implement `renderHistorias`** — append to `scripts/lib/history-render.js`:

```js
const KIND_LABEL = {
  place: { en: 'Place', es: 'Lugar' }, person: { en: 'Person', es: 'Persona' },
  object: { en: 'Object', es: 'Objeto' }, event: { en: 'Event', es: 'Suceso' },
};

export function renderHistorias(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const cards = (data.stories || []).map(s => {
    const kind = (KIND_LABEL[s.kind] && KIND_LABEL[s.kind][lang]) || esc(s.kind);
    return '<article class="cr-story">' +
      '<span class="cr-story-kind">' + esc(kind) + '</span>' +
      '<h3>' + esc(s.title && s.title[lang]) + '</h3>' +
      '<p>' + esc(s.body && s.body[lang]) + '</p>' +
      '</article>';
  }).join('');
  return '<h2>' + esc(heading) + '</h2><div class="cr-stories">' + cards + '</div>';
}
```

- [ ] **Step 8: Run render tests** — `node --test tests/history-render.test.js` → PASS (3 tests total).

- [ ] **Step 9: Create the seed stories** — create `content/history/stories.json` (real content from the dossier; note `heading` lives here too so the build can pass the whole object to `renderHistorias`):

```json
{
  "heading": { "en": "Stories of the town", "es": "Historias del pueblo" },
  "stories": [
    {
      "id": "el-bramido",
      "kind": "place",
      "title": { "en": "El Bramido & the founding", "es": "El Bramido y la fundación" },
      "body": {
        "en": "The town grew from the lands once called El Bramido, settled around the turn of the 19th century by four Hernández (Padilla) brothers. No founding document survives, so the often-cited year 1793 is best treated as approximate.",
        "es": "El pueblo surgió de las tierras antes llamadas El Bramido, pobladas hacia inicios del siglo XIX por cuatro hermanos Hernández (Padilla). No se conserva documento fundacional, por lo que el año 1793, muy citado, conviene tomarlo como aproximado."
      }
    },
    {
      "id": "parroquia-san-jose",
      "kind": "place",
      "title": { "en": "The parish of San José", "es": "La parroquia de San José" },
      "body": {
        "en": "A chapel of 1822 preceded the temple of local red cantera begun on 19 March 1889; the parish was erected on 15 May 1910 under its first priest, Fermín Padilla. The patronal feast falls on the second Sunday of May.",
        "es": "Una capilla de 1822 precedió al templo de cantera roja iniciado el 19 de marzo de 1889; la parroquia se erigió el 15 de mayo de 1910 con su primer párroco, Fermín Padilla. La fiesta patronal es el segundo domingo de mayo."
      }
    },
    {
      "id": "batalla-tepatitlan-1929",
      "kind": "event",
      "title": { "en": "The Battle of Tepatitlán, 1929", "es": "La Batalla de Tepatitlán, 1929" },
      "body": {
        "en": "On 18–19 April 1929, Cristeros under Father-General José Reyes Vega ambushed a far larger federal-agrarista force near Tepatitlán. It became a landmark Cristero victory of Los Altos — at the cost of Vega's own life.",
        "es": "El 18 y 19 de abril de 1929, cristeros al mando del padre-general José Reyes Vega emboscaron a una fuerza federal-agrarista mucho mayor cerca de Tepatitlán. Fue una victoria cristera emblemática de Los Altos, al costo de la vida del propio Vega."
      }
    },
    {
      "id": "santo-toribio",
      "kind": "person",
      "title": { "en": "Santo Toribio, patron of migrants", "es": "Santo Toribio, patrono de los migrantes" },
      "body": {
        "en": "Across Los Altos, Santo Toribio Romo — canonized in 2000 — is venerated as the patron of migrants, said to aid those crossing to the United States. His devotion threads through the region's migration story.",
        "es": "En todo Los Altos, Santo Toribio Romo —canonizado en 2000— es venerado como patrono de los migrantes, a quienes se atribuye que auxilia al cruzar a Estados Unidos. Su devoción atraviesa la historia migratoria de la región."
      }
    }
  ]
}
```

- [ ] **Step 10: Verify the seed validates** — run a one-off check:

```bash
node --input-type=module -e "import('./scripts/lib/history-stories.js').then(async m => { const fs=await import('node:fs'); const d=JSON.parse(fs.readFileSync('content/history/stories.json','utf8')); console.log(m.validateStories(d)); })"
```
Expected: `{ valid: true, errors: [] }`.

- [ ] **Step 11: Commit**

```bash
git add scripts/lib/history-stories.js scripts/lib/history-render.js content/history/stories.json tests/history-stories.test.js tests/history-render.test.js
git commit -m "feat(history): Story validator, renderHistorias, seed stories"
```

---

## Task 3: Content — timeline data, sources, soften claims, add Battle of Tepatitlán

**Files:** Modify `content/pages/history.json`

Note the file is bilingual `{en,es}` leaves loaded by `loadContent`/`resolveLang`; keep every added field with BOTH languages.

- [ ] **Step 1: Add the `timeline` block.** Insert a top-level `timeline` key (sibling of `sections`):

```json
"timeline": {
  "heading": { "en": "Timeline", "es": "Línea del tiempo" },
  "entries": [
    { "year": "1530", "label": { "en": "Nueva Galicia: the region is entered and evangelized", "es": "Nueva Galicia: se incursiona y evangeliza la región" } },
    { "year": "1707", "label": { "en": "Spanish settlement of San José de Bazarte", "es": "Asentamiento español de San José de Bazarte" } },
    { "year": "1793", "label": { "en": "Hernández (Padilla) brothers settle El Bramido (approx.)", "es": "Los hermanos Hernández (Padilla) pueblan El Bramido (aprox.)" } },
    { "year": "1824", "label": { "en": "Tepatitlán becomes a villa; Tercer Cantón de La Barca", "es": "Tepatitlán se hace villa; Tercer Cantón de La Barca" } },
    { "year": "1883", "label": { "en": "Tepatitlán elevated to a city: 'de Morelos'", "es": "Tepatitlán se eleva a ciudad: «de Morelos»" } },
    { "year": "1889", "label": { "en": "The temple of red cantera is begun", "es": "Se inicia el templo de cantera roja" } },
    { "year": "1910", "label": { "en": "San José de Gracia erected as a parish", "es": "San José de Gracia se erige en parroquia" } },
    { "year": "1917", "label": { "en": "Becomes a comisaría política of Tepatitlán", "es": "Pasa a comisaría política de Tepatitlán" } },
    { "year": "1926–29", "label": { "en": "The Cristero War rages across Los Altos", "es": "La Guerra Cristera asola Los Altos" } },
    { "year": "1929", "label": { "en": "The Battle of Tepatitlán (19 April)", "es": "La Batalla de Tepatitlán (19 de abril)" } },
    { "year": "1939", "label": { "en": "Raised to delegación política", "es": "Se eleva a delegación política" } },
    { "year": "2000", "label": { "en": "Population 5,128 (INEGI)", "es": "Población 5,128 (INEGI)" } },
    { "year": "2010", "label": { "en": "Population 5,190 (INEGI)", "es": "Población 5,190 (INEGI)" } },
    { "year": "2020", "label": { "en": "Population 5,441 — 3rd-largest in the municipality", "es": "Población 5,441 — 3.ª del municipio" } },
    { "year": "2021", "label": { "en": "The town's Cultural Center opens", "es": "Abre el Centro Cultural del pueblo" } }
  ]
}
```

- [ ] **Step 2: Replace `sources.body` with the real citation list** (both langs — same URLs, localized link text). Set `sources.body.en` and `.es` to an HTML `<ul>` with these items (≥6):

```html
<ul>
<li><a href="https://iieg.gob.mx/ns/wp-content/uploads/2022/03/Analisis-3309-San-Jose-de-Gracia.pdf">IIEG Jalisco — Análisis sociodemográfico de San José de Gracia (2020)</a></li>
<li><a href="https://www.citypopulation.de/en/mexico/jalisco/tepatitl%C3%A1n_de_morelos/140930291__san_jos%C3%A9_de_gracia/">INEGI / CityPopulation — locality 140930291, census series</a></li>
<li><a href="https://es.wikipedia.org/wiki/San_Jos%C3%A9_de_Gracia_(Jalisco)">Wikipedia (ES) — San José de Gracia (Jalisco)</a></li>
<li><a href="https://www.ub.edu/geocrit/sn/sn-218-18.htm">UB / Scripta Nova — el Cantón de La Barca y la división territorial de Jalisco</a></li>
<li><a href="https://www.tepatitlan.gob.mx/archivomunicipal/boletines/documentos++/3.2010-2012/Bolet%C3%ADn%20No.14%20El%20conflicto%20Religioso%20en%20Tepatitl%C3%A1n.pdf">Archivo Histórico Municipal de Tepatitlán — Boletín No. 14 (la Cristiada)</a></li>
<li><a href="https://es.wikipedia.org/wiki/Batalla_de_Tepatitl%C3%A1n">Wikipedia (ES) — Batalla de Tepatitlán (1929)</a></li>
</ul>
```
(Localize only the trailing description text in `.es`; keep the same `href`s.) Keep the existing `sources.note` (the method note) as-is.

- [ ] **Step 3: Add the Battle of Tepatitlán to `sections.cristero.body`** (append a sentence to BOTH langs, before the closing of the existing body):

- en: ` The war's clearest local anchor is the <strong>Battle of Tepatitlán (18–19 April 1929)</strong>, where Cristeros under Father-General José Reyes Vega defeated a much larger federal force — a landmark victory of Los Altos, though Vega himself fell.`
- es: ` El ancla local más clara de la guerra es la <strong>Batalla de Tepatitlán (18 y 19 de abril de 1929)</strong>, donde los cristeros al mando del padre-general José Reyes Vega vencieron a una fuerza federal muy superior —una victoria emblemática de Los Altos, aunque el propio Vega cayó.`

- [ ] **Step 4: Soften the four flagged claims** (edit in place, both langs):
  - **1857 vecinos** (in `sections.administrative.body`): change any definite "in 1857 the vecinos…" to attributed/hedged wording, e.g. en: `Municipal-archive proceedings (attributed to 1857) suggest the <em>vecinos de San José de Gracia</em>…`; es: `Diligencias del archivo municipal (atribuidas a 1857) sugieren que los <em>vecinos de San José de Gracia</em>…`.
  - **Parish dates / first priest** (`sections.faith.body`): ensure it reads as single-sourced, e.g. append `(según fuentes locales / per local sources)` — keep the existing caveat if present.
  - **Hernández testaments / 1833 capellanía** (`sections.origins.body` / `faith.body`): attribute to the Tepatitlán archive rather than stating as web-verifiable (e.g. `documents in the Tepatitlán municipal archive` / `documentos del archivo municipal de Tepatitlán`).
  - **§260 verbatim quote** (`sections.book1897.body`): mark the blockquote as transcribed with wording pending, e.g. add after the quote en: `<span class="cr-flag">(transcribed; exact wording pending a page scan)</span>` and es: `<span class="cr-flag">(transcrito; redacción exacta por confirmar con el facsímil)</span>`.

- [ ] **Step 5: Validate the JSON parses and keeps bilingual leaves**

```bash
node -e "const c=require('./content/pages/history.json'); console.log('timeline entries:', c.timeline.entries.length); console.log('sources li:', (c.sources.body.en.match(/<li/g)||[]).length); console.log('battle en:', /Battle of Tepatitlán/.test(c.sections.cristero.body.en), 'es:', /Batalla de Tepatitlán/.test(c.sections.cristero.body.es));"
```
Expected: `timeline entries: 15`, `sources li: 6`, `battle en: true es: true`.

- [ ] **Step 6: Commit**

```bash
git add content/pages/history.json
git commit -m "content(history): timeline data, cited sources, Battle of Tepatitlán, softened claims"
```

---

## Task 4: Wire the build + template sections + CSS + page tests

**Files:** Modify `scripts/build.js`, `templates/pages/history.html`, `tests/history-page.test.js`

- [ ] **Step 1: Import the renderers in `scripts/build.js`** (top, with the other lib imports):

```js
import { renderTimeline, renderHistorias } from './lib/history-render.js';
import { validateStories } from './lib/history-stories.js';
```

- [ ] **Step 2: Inject history content in `buildOnePage`.** Right after the existing `businesses` augmentation block (after line ~87, before `for (const lang of LANGS)`), add:

```js
  // History page: validate the Story atoms and pre-render the timeline + featured stories
  // into {en,es} HTML fields (the template engine has no loops).
  if (pageName === 'history') {
    const stories = await loadContent(join(ROOT, 'content/history/stories.json'));
    const v = validateStories(stories);
    if (!v.valid) throw new Error('invalid stories.json: ' + v.errors.join('; '));
    content.timeline.body = { en: renderTimeline(content.timeline, 'en'), es: renderTimeline(content.timeline, 'es') };
    content.historias = { body: { en: renderHistorias(stories, 'en'), es: renderHistorias(stories, 'es') } };
  }
```
Note: `renderTimeline`/`renderHistorias` read the raw `{en,es}` leaves and pick `lang` themselves, so they run on the un-resolved `content`/`stories` objects here (before `resolveLang`).

- [ ] **Step 3: Add the two template sections** in `templates/pages/history.html`. After the hero `</header>` and before `<section class="cr-section" id="sec-place">`, add:

```html
  <section class="cr-timeline" id="sec-timeline">{{timeline.body}}</section>
```
And after the `sec-book1897` section (before `<section class="cr-sources">`), add:

```html
  <section class="cr-historias" id="sec-historias">{{historias.body}}</section>
```

- [ ] **Step 4: Add CSS** to the `<style>` block in `templates/pages/history.html`:

```css
  .cr-timeline { margin: 0 0 2.8rem; }
  .cr-timeline h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 500; margin-bottom: 1rem; color: var(--dark); }
  ol.cr-tl { list-style: none; margin: 0; padding: 0 0 0 1.2rem; border-left: 2px solid var(--clay); }
  ol.cr-tl li { position: relative; padding: 0 0 1rem 1rem; }
  ol.cr-tl li::before { content: ""; position: absolute; left: -1.65rem; top: .35rem; width: 9px; height: 9px; border-radius: 50%; background: var(--clay); }
  .cr-tl-year { font-weight: 600; color: var(--clay); margin-right: .6rem; }
  .cr-tl-label { color: rgba(28,19,9,.82); }
  .cr-historias { margin: 2.6rem 0; }
  .cr-historias h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 500; margin-bottom: 1rem; color: var(--dark); }
  .cr-stories { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
  .cr-story { border: 1px solid var(--mist); border-radius: 10px; padding: 1rem; }
  .cr-story-kind { font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: var(--clay); }
  .cr-story h3 { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 1.1rem; margin: .3rem 0 .4rem; }
  .cr-story p { font-size: .92rem; line-height: 1.6; color: rgba(28,19,9,.78); margin: 0; }
  .cr-flag { font-size: .8rem; color: rgba(28,19,9,.5); font-style: italic; }
```
Also add `.cr-timeline, .cr-historias { page-break-inside: avoid; }` inside the existing `@media print {}` block.

- [ ] **Step 5: Extend `tests/history-page.test.js`.** It already has `buildHistory(lang)`. Add after the existing built-page assertions:

```js
test('built history page renders timeline, historias, Battle, and ≥6 sources', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.match(html, /class="cr-timeline"/);
    assert.match(html, /ol class="cr-tl"/);
    assert.ok((html.match(/<li/g) || []).length >= 15, 'timeline + sources list items present');
    assert.match(html, /class="cr-historias"/);
    assert.ok((html.match(/class="cr-story"/g) || []).length >= 4, 'four seed stories');
    assert.match(html, lang === 'es' ? /Batalla de Tepatitlán/ : /Battle of Tepatitlán/);
  }
});
```
(If `buildHistory` isn't already defined in the file, define it mirroring the existing build harness: load `history.json`, `stories.json`, run the same injection as Step 2, then `buildPage({lang, layout, pageTemplate, content, shared, siteUrl, pageSlugs})` with the test's existing fixtures.)

- [ ] **Step 6: Build + run the full suite**

```bash
node scripts/build.js >/dev/null 2>&1 && echo BUILD_OK
node --test --test-concurrency=1 2>&1 | tail -6
```
Expected: `BUILD_OK`; all tests pass, 0 fail. Confirm the timeline + historias rendered:
```bash
grep -c 'class="cr-tl"' dist/es/historia.html; grep -c 'class="cr-story"' dist/es/historia.html
```
Expected: `1` and `4`.

- [ ] **Step 7: Commit**

```bash
git add scripts/build.js templates/pages/history.html tests/history-page.test.js
git commit -m "feat(history): render timeline + featured stories on La Crónica"
```

---

## Task 5: Preview + review gate

- [ ] Push `feature/history-phase1`, get the Vercel preview URL, wait for READY.
- [ ] Browser-verify (`/es/historia` and `/en/history`): timeline reads in order with year dots; the four Historias cards render with kind chips; the Cristero section shows the Battle of Tepatitlán; the Sources list shows the 6 cited links; print preview keeps the timeline/historias intact. No console errors.
- [ ] Summarize results; **pause for Jaime's review** (standing rule — do not merge to main). On approval: `superpowers:finishing-a-development-branch` → merge `--no-ff`, push, confirm prod READY, update the Memory Bank.

---

## Self-Review

**Spec coverage:** 1a verify+cite El Pueblo → Task 3 (sources, soften, Battle) ✓; 1b timeline → Tasks 1 + 3 + 4 ✓; 1c Story model + validator + featured strip → Tasks 2 + 4 ✓; bilingual throughout ✓; testing (history-render, history-stories, history-page) ✓; rollout/gate → Task 5 ✓. No gaps.

**Placeholder scan:** all code/content shown in full; seed stories + timeline entries + sources are real content, not placeholders; commands have expected output. The Task-3 "soften" edits describe exact replacement wording for each of the 4 items (engineer applies them to the live strings).

**Type consistency:** `renderTimeline(timeline, lang)` and `renderHistorias(data, lang)` both read `{en,es}` leaves + pick `lang`; build passes the raw (un-resolved) objects (Task 4 Step 2) — consistent. `validateStories(data)` → `{valid, errors}` used in build (Task 4) and tests (Task 2). Content fields injected (`content.timeline.body`, `content.historias.body`) match the template tokens `{{timeline.body}}` / `{{historias.body}}` (Task 4 Step 3). `stories.json` carries `heading` + `stories[]`, matching `renderHistorias`'s `data.heading`/`data.stories`.
