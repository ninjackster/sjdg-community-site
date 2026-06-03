# Collective History — Phase 4: Navegación + Colabora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]`.

**Goal:** Add a curated Contents jump-index with a dependency-free live filter, expand the contribution guide, and add a seeded Créditos/contributors section to La Crónica — zero new runtime dependencies.

**Architecture:** Same as Phases 1–3: pure render helpers in `scripts/lib/history-render.js` emit `{en,es}` HTML strings; `scripts/build.js` injects them into `content.*` inside the `if (pageName === 'history')` block; new content lives in JSON; `templates/pages/history.html` gets new `<section>`s, CSS, and a tiny inline filter `<script>`. Tested with `node --test --test-concurrency=1` (baseline 176).

**Tech Stack:** Node ESM, custom static builder, node:test. No libraries.

---

## Task 1: `renderIndex` helper + Índice content + injection + template + filter script

**Files:**
- Modify: `scripts/lib/history-render.js` (add `renderIndex`)
- Modify: `content/pages/history.json` (add `indice` block)
- Modify: `scripts/build.js` (inject `content.indice.body`)
- Modify: `templates/pages/history.html` (índice section near top + filter `<script>` + CSS)
- Test: `tests/history-render.test.js` (new) and `tests/history-page.test.js`

- [ ] **Step 1: Failing unit test** — create `tests/history-render.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndex } from '../scripts/lib/history-render.js';

const DATA = {
  heading: { en: 'Contents', es: 'Índice' },
  filter: { en: 'Filter…', es: 'Filtrar…' },
  entries: [
    { id: 'sec-raices', label: { en: 'Ancient roots', es: 'Raíces antiguas' } },
    { id: 'sec-cristero', label: { en: 'The Cristero era', es: 'La Cristiada' } },
  ],
};
test('renderIndex emits anchor jump-links + a filter input, bilingual', () => {
  const es = renderIndex(DATA, 'es');
  assert.match(es, /<h2>Índice<\/h2>/);
  assert.match(es, /href="#sec-raices"/);
  assert.match(es, /La Cristiada/);
  assert.match(es, /placeholder="Filtrar…"/);
  assert.match(es, /class="cr-index-filter"/);
  assert.doesNotMatch(es, /\{\{/);
  const en = renderIndex(DATA, 'en');
  assert.match(en, /Ancient roots/);
  assert.match(en, /href="#sec-cristero"/);
});
```

- [ ] **Step 2: Run, expect FAIL** — `node --test tests/history-render.test.js` → fails (renderIndex undefined).

- [ ] **Step 3: Implement** in `scripts/lib/history-render.js` (append, reuse existing `esc`):
```js
export function renderIndex(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const ph = esc((data.filter && data.filter[lang]) || '');
  const items = (data.entries || []).map(e =>
    '<li class="cr-index-item"><a href="#' + esc(e.id) + '">' +
    esc(e.label && e.label[lang]) + '</a></li>'
  ).join('');
  const aria = lang === 'es' ? 'Filtrar el índice' : 'Filter the contents';
  return '<h2>' + esc(heading) + '</h2>' +
    '<input class="cr-index-filter" type="text" placeholder="' + ph + '" aria-label="' + aria + '" />' +
    '<ul class="cr-index-list">' + items + '</ul>';
}
```

- [ ] **Step 4: Run, expect PASS** — `node --test tests/history-render.test.js`.

- [ ] **Step 5: Add `indice` content** to `content/pages/history.json` (top-level key). Curate the entries to the real section ids in page order (labels mirror each section h2). Author this block:
```json
"indice": {
  "heading": { "en": "Contents", "es": "Índice" },
  "filter": { "en": "Filter the chronicle…", "es": "Filtrar la crónica…" },
  "entries": [
    { "id": "sec-timeline", "label": { "en": "Timeline", "es": "Línea del tiempo" } },
    { "id": "sec-raices", "label": { "en": "Ancient roots", "es": "Raíces antiguas" } },
    { "id": "sec-place", "label": { "en": "Land & place", "es": "Tierra y lugar" } },
    { "id": "sec-mapa", "label": { "en": "Where it sits (map)", "es": "Dónde se encuentra (mapa)" } },
    { "id": "sec-origins", "label": { "en": "Origins: the hacienda", "es": "Orígenes: la hacienda" } },
    { "id": "sec-administrative", "label": { "en": "From Nueva Galicia to delegación", "es": "De la Nueva Galicia a la delegación" } },
    { "id": "sec-faith", "label": { "en": "Faith & the parish", "es": "Fe y parroquia" } },
    { "id": "sec-cristero", "label": { "en": "The Cristero era", "es": "La Cristiada" } },
    { "id": "sec-economy", "label": { "en": "Land & work", "es": "Tierra y trabajo" } },
    { "id": "sec-people", "label": { "en": "The people", "es": "La gente" } },
    { "id": "sec-diaspora", "label": { "en": "The diaspora", "es": "La diáspora" } },
    { "id": "sec-culture", "label": { "en": "Fiestas & everyday life", "es": "Fiestas y costumbres" } },
    { "id": "sec-book1897", "label": { "en": "The 1897 record", "es": "El registro de 1897" } },
    { "id": "sec-cronista", "label": { "en": "The town's chronicler", "es": "El cronista del pueblo" } },
    { "id": "sec-notables", "label": { "en": "Sons & daughters of the town", "es": "Hijos del pueblo" } },
    { "id": "sec-historias", "label": { "en": "Stories of the town", "es": "Historias del pueblo" } },
    { "id": "sec-voces", "label": { "en": "Voices", "es": "Voces" } },
    { "id": "sec-fotos", "label": { "en": "Then & now", "es": "Antes y ahora" } },
    { "id": "sec-colabora", "label": { "en": "Share a memory", "es": "Comparte una memoria" } },
    { "id": "sec-creditos", "label": { "en": "Credits & contributors", "es": "Créditos y colaboradores" } },
    { "id": "sec-sources", "label": { "en": "Sources & method", "es": "Fuentes y método" } }
  ]
}
```

- [ ] **Step 6: Inject in `scripts/build.js`** — import update + injection. Change the history-render import line to add `renderIndex`:
`import { renderTimeline, renderHistorias, renderVoces, renderFotos, renderIndex } from './lib/history-render.js';`
Add inside the `if (pageName === 'history')` block:
```js
content.indice = { body: { en: renderIndex(content.indice, 'en'), es: renderIndex(content.indice, 'es') } };
```
NOTE: `content.indice` already holds the authored `{heading,filter,entries}`; we overwrite it with `{body}` AFTER reading those fields — so capture first:
```js
const indiceData = content.indice;
content.indice = { body: { en: renderIndex(indiceData, 'en'), es: renderIndex(indiceData, 'es') } };
```

- [ ] **Step 7: Template** — in `templates/pages/history.html`, add the índice section right after the `<div class="cr-actions">…</div>` header block and before `<section class="cr-timeline" …>`:
```html
  <nav class="cr-index" id="sec-index" aria-label="Contents">{{indice.body}}</nav>
```
Add the filter `<script>` next to the existing slider script (before `</div>` close of `.cr-wrap`):
```html
<script>
  (function () {
    var box = document.querySelector('.cr-index-filter');
    if (!box) return;
    var items = Array.prototype.slice.call(document.querySelectorAll('.cr-index-item'));
    var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    box.addEventListener('input', function () {
      var q = norm(box.value.trim());
      items.forEach(function (li) {
        li.style.display = (!q || norm(li.textContent).indexOf(q) !== -1) ? '' : 'none';
      });
    });
  })();
</script>
```
Add CSS (in the page `<style>`, near the other `.cr-*` rules):
```css
  .cr-index { margin: 1.2rem 0 1.6rem; padding: 1rem 1.2rem; background: rgba(196,120,90,.06); border-radius: 10px; }
  .cr-index h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
  .cr-index-filter { width: 100%; max-width: 320px; padding: .4rem .6rem; margin-bottom: .6rem; border: 1px solid #cbb89a; border-radius: 6px; font: inherit; }
  .cr-index-list { list-style: none; padding: 0; margin: 0; column-width: 220px; column-gap: 1.5rem; }
  .cr-index-item { margin: .15rem 0; break-inside: avoid; }
  .cr-index-item a { text-decoration: none; }
  @media print { .cr-index { display: none; } }
```

- [ ] **Step 8: Page test** — in `tests/history-page.test.js`, mirror the indice injection inside `buildHistory` (capture-then-overwrite as in build.js) and add a test:
```js
// inside buildHistory, after loading content:
const indiceData = content.indice;
content.indice = { body: { en: renderIndex(indiceData, 'en'), es: renderIndex(indiceData, 'es') } };
```
(import `renderIndex` in the test file's history-render import) and:
```js
test('built history page renders the Contents jump-index with filter', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    assert.match(html, /id="sec-index"/);
    assert.match(html, /class="cr-index-filter"/);
    assert.match(html, /href="#sec-cristero"/);
    assert.match(html, /href="#sec-creditos"/);
  }
});
```

- [ ] **Step 9: Build + full suite** — `node scripts/build.js` then `node --test --test-concurrency=1` → all pass.

- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat(history): Contents jump-index + dependency-free live filter"`.

---

## Task 2: Expand the "Graba a tu abuelo" contribution guide

**Files:** Modify `content/pages/history.json` (`colabora.body`); Test `tests/history-page.test.js`.

- [ ] **Step 1: Edit `colabora.body`** (both langs) to a clear step list. Replace the current body with (EN):
```
<p>This chronicle grows with the community. If you have <strong>old photos</strong>, <strong>documents</strong>, or <strong>stories</strong> — especially elders' memories — they belong here.</p><ol class="cr-steps"><li>Sit with an elder and a box of old photos.</li><li>Open your phone's voice recorder.</li><li>Let them talk — five minutes is plenty.</li><li>Send the audio and photos by WhatsApp.</li><li>We add them to the chronicle, with credit.</li></ol><p>Send whatever you have — audio, photos, documents, names, dates — in Spanish or English. Nothing is too small.</p>
```
ES:
```
<p>Esta crónica crece con la comunidad. Si tienes <strong>fotos antiguas</strong>, <strong>documentos</strong> o <strong>historias</strong> — sobre todo recuerdos de los mayores — aquí tienen su lugar.</p><ol class="cr-steps"><li>Siéntate con un abuelo y una caja de fotos viejas.</li><li>Abre la grabadora de voz del teléfono.</li><li>Déjalo hablar — cinco minutos bastan.</li><li>Envía el audio y las fotos por WhatsApp.</li><li>Las agregamos a la crónica, con su crédito.</li></ol><p>Envía lo que tengas — audio, fotos, documentos, nombres, fechas — en español o inglés. Nada es demasiado pequeño.</p>
```
Keep the existing `whatsapp_url`/`whatsapp_label` fields untouched (template already renders the CTA button).

- [ ] **Step 2: CSS** — add to the page `<style>`: `.cr-steps { margin: .8rem 0; padding-left: 1.3rem; } .cr-steps li { margin: .3rem 0; }`

- [ ] **Step 3: Page test** — extend the Voces/Colabora test (or add) to assert the steps render:
```js
test('colabora guide shows recording steps', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.match(html, /class="cr-steps"/);
    assert.match(html, lang === 'es' ? /Abre la grabadora de voz/ : /Open your phone's voice recorder/);
    assert.match(html, /href="https:\/\/wa\.me\/523316963003"/);
  }
});
```

- [ ] **Step 4: Build + tests** — `node scripts/build.js` + `node --test --test-concurrency=1` pass.

- [ ] **Step 5: Commit** — `git commit -am "feat(history): expand Colabora into a record-an-elder step guide"`.

---

## Task 3: `renderCreditos` helper + creditos.json + injection + template + CSS + tests

**Files:** Create `content/history/creditos.json`; Modify `scripts/lib/history-render.js`; Modify `scripts/build.js`; Modify `templates/pages/history.html`; Test `tests/history-render.test.js`, `tests/history-page.test.js`.

- [ ] **Step 1: Failing unit test** — add to `tests/history-render.test.js`:
```js
import { renderCreditos } from '../scripts/lib/history-render.js';
test('renderCreditos renders grouped roles + names, bilingual', () => {
  const data = {
    heading: { en: 'Credits', es: 'Créditos' },
    intro: { en: 'Built by many hands.', es: 'Hecho por muchas manos.' },
    groups: [{ role: { en: 'Chronicler', es: 'Cronista' }, names: ['Don Taurino Arámbula Vázquez'] }],
    invite: { en: 'Add your name by contributing.', es: 'Suma tu nombre colaborando.' },
  };
  const es = renderCreditos(data, 'es');
  assert.match(es, /<h2>Créditos<\/h2>/);
  assert.match(es, /Cronista/);
  assert.match(es, /Don Taurino Arámbula Vázquez/);
  assert.match(es, /Suma tu nombre/);
  assert.doesNotMatch(es, /\{\{/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `renderCreditos`** in `scripts/lib/history-render.js`:
```js
export function renderCreditos(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const intro = (data.intro && data.intro[lang]) || '';
  const groups = (data.groups || []).map(g =>
    '<li class="cr-credit"><span class="cr-credit-role">' + esc(g.role && g.role[lang]) + ':</span> ' +
    (g.names || []).map(esc).join(', ') + '</li>'
  ).join('');
  const invite = (data.invite && data.invite[lang]) || '';
  return '<h2>' + esc(heading) + '</h2>' +
    (intro ? '<p>' + esc(intro) + '</p>' : '') +
    '<ul class="cr-credits-list">' + groups + '</ul>' +
    (invite ? '<p class="cr-credits-invite">' + esc(invite) + '</p>' : '');
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Create `content/history/creditos.json`:**
```json
{
  "heading": { "en": "Credits & contributors", "es": "Créditos y colaboradores" },
  "intro": { "en": "This chronicle stands on the work of many — the people and institutions who gathered, preserved, and shared the town's memory.", "es": "Esta crónica se apoya en el trabajo de muchos — las personas e instituciones que reunieron, conservaron y compartieron la memoria del pueblo." },
  "groups": [
    { "role": { "en": "Town chronicler", "es": "Cronista del pueblo" }, "names": ["Don Taurino Arámbula Vázquez (†)"] },
    { "role": { "en": "Oral informant", "es": "Informante oral" }, "names": ["Don Porfirio Hernández Valle"] },
    { "role": { "en": "Biography & link", "es": "Semblanza y enlace" }, "names": ["Juan Ramón Ramírez Andrade — Museo Nacional Humanista, Atotonilco el Alto"] },
    { "role": { "en": "Cited institutions", "es": "Instituciones citadas" }, "names": ["IIEG Jalisco", "INEGI", "Archivo Histórico Municipal de Tepatitlán", "Diócesis de San Juan de los Lagos", "Arquidiócesis de Guadalajara", "Secretaría de Cultura de Jalisco"] },
    { "role": { "en": "Compiled by", "es": "Compilación" }, "names": ["Jaime Murillo Mena"] }
  ],
  "invite": { "en": "This list grows with the town. Share a memory, a photo, or a name — and join it.", "es": "Esta lista crece con el pueblo. Comparte una memoria, una foto o un nombre — y súmate." }
}
```

- [ ] **Step 6: Inject in `scripts/build.js`** — add `renderCreditos` to the history-render import; in the history block:
```js
const creditos = await loadContent(join(ROOT, 'content/history/creditos.json'));
content.creditos = { body: { en: renderCreditos(creditos, 'en'), es: renderCreditos(creditos, 'es') } };
```

- [ ] **Step 7: Template** — add the créditos section after `#sec-colabora` and before `#sec-sources` (so the index entry `sec-creditos` resolves):
```html
  <section class="cr-section cr-creditos" id="sec-creditos">{{creditos.body}}</section>
```
CSS:
```css
  .cr-creditos-list, .cr-credits-list { list-style: none; padding: 0; margin: .6rem 0; }
  .cr-credit { margin: .35rem 0; }
  .cr-credit-role { font-weight: 600; }
  .cr-credits-invite { font-style: italic; color: #6b5b43; }
```
Add to the print-avoid rule list: `.cr-creditos`.

- [ ] **Step 8: Page test + harness** — in `tests/history-page.test.js` `buildHistory`, mirror the creditos injection:
```js
const creditos = await loadContent(join(ROOT, 'content/history/creditos.json'));
content.creditos = { body: { en: renderCreditos(creditos, 'en'), es: renderCreditos(creditos, 'es') } };
```
(import renderCreditos) and add:
```js
test('built history page renders seeded Créditos section', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.match(html, /id="sec-creditos"/);
    assert.match(html, /Taurino Arámbula Vázquez/);
    assert.match(html, /Jaime Murillo Mena/);
    assert.match(html, lang === 'es' ? /Créditos y colaboradores/ : /Credits & contributors/);
  }
});
```

- [ ] **Step 9: Build + full suite green.**

- [ ] **Step 10: Commit** — `git commit -am "feat(history): Créditos/contributors section seeded with the lineage"`.

---

## Task 4: Final review, browser verify, merge gate

- [ ] Dispatch a final code review over the Phase 4 diff (or controller self-review).
- [ ] `git push -u origin feature/history-phase4`; get the real branch-alias preview URL via Vercel `list_deployments`; open the tab.
- [ ] Browser-verify `/es/historia` + `/en/history`: índice renders with jump links; typing in the filter narrows entries; clicking an entry jumps; guide steps show; Créditos seeded; no console errors; no unresolved tokens; print hides the índice.
- [ ] Pause for the user's explicit **merge**. On approval: merge to main, push, verify prod, clean up worktree/branch, update Memory Bank.

## Notes / risks
- `content.indice` overwrite: capture `indiceData` BEFORE overwriting (Task 1 Step 6) — same for tests.
- Keep the filter script defensive (`if (!box) return;`) so other pages are unaffected.
- Index is curated content; if sections change later, update `indice.entries` to match.
