# Collective History — Phase 2 (Voces + Fotos + Colabora) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the oral-history (Voces) and "then & now" photo (Fotos) sections to La Crónica with graceful empty states, plus a contact-based contribution section (Colabora) — opening the community-memory floodgates while the first content is gathered.

**Architecture:** Same as Phase 1 — pure tested renderers produce HTML injected as `{en,es}` content fields in `buildOnePage` (the template engine has no loops). Audio uses a flexible `src` (committed file OR external URL). The then/now slider is **dependency-free** vanilla JS. Contribution is **contact-based** (guide + WhatsApp link) — no backend, no public write endpoint (the history page is public; the family review queue is password-gated). Bilingual EN/ES throughout.

**Decisions (this phase):** audio = flexible file-or-URL; contribution = contact-based (WhatsApp `https://wa.me/523316963003`, already public on the site; editable in content). Seed Voces/Fotos **empty** (CTA) — real content arrives via curation; components are unit-tested with fixtures.

**Spec:** `docs/superpowers/specs/2026-06-02-collective-history-design.md` (Phase 2) · **Research:** the dossier.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `scripts/lib/history-render.js` | Add `renderVoces(data, lang)`, `renderFotos(data, lang)` (reuse `esc`). | **Modify** |
| `scripts/lib/history-media.js` | `validateVoces(data)`, `validateFotos(data)` (ids, bilingual transcript/caption, src strings, kind). | **Create** |
| `content/history/voces.json` | `{ heading, intro, empty, items:[] }` — seeded empty. | **Create** |
| `content/history/fotos.json` | `{ heading, intro, empty, pairs:[] }` — seeded empty. | **Create** |
| `content/pages/history.json` | Add `colabora` block (heading, guide HTML, whatsapp url+label). | **Modify** |
| `templates/pages/history.html` | Add `.cr-voces`, `.cr-fotos`, `.cr-colabora` sections + CSS + the dep-free slider `<script>`. | **Modify** |
| `scripts/build.js` | In the `history` block: validate + inject `voces.body`, `fotos.body` `{en,es}`. | **Modify** |
| `tests/history-render.test.js` | Add renderVoces + renderFotos tests. | **Modify** |
| `tests/history-media.test.js` | validateVoces / validateFotos tests. | **Create** |
| `tests/history-page.test.js` | Assert Voces/Fotos/Colabora sections + empty states + WhatsApp link render; mirror the build injection in `buildHistory`. | **Modify** |

---

## Task 1: `renderVoces`

**Files:** Modify `scripts/lib/history-render.js`, `tests/history-render.test.js`

- [ ] **Step 1: Append the failing test** to `tests/history-render.test.js`:

```js
import { renderVoces } from '../scripts/lib/history-render.js';

test('renderVoces: empty -> CTA; items -> audio + transcript; file vs embed', () => {
  const empty = renderVoces({ heading: { en: 'Voices', es: 'Voces' }, intro: { en: '', es: '' }, empty: { en: 'Share one', es: 'Comparte una' }, items: [] }, 'es');
  assert.match(empty, /Voces/);
  assert.match(empty, /Comparte una/);
  assert.doesNotMatch(empty, /<audio|<iframe/);

  const data = {
    heading: { en: 'Voices', es: 'Voces' }, intro: { en: '', es: '' }, empty: { en: '', es: '' },
    items: [
      { id: 'v1', kind: 'file', audioSrc: '/voces/v1.mp3', speaker: { en: 'Doña Ana', es: 'Doña Ana' }, transcript: { en: 'I remember…', es: 'Recuerdo…' } },
      { id: 'v2', kind: 'embed', audioSrc: 'https://archive.org/embed/x', speaker: { en: 'Don José', es: 'Don José' }, transcript: { en: 'In 1950…', es: 'En 1950…' } },
    ],
  };
  const html = renderVoces(data, 'es');
  assert.match(html, /<audio[^>]+src="\/voces\/v1\.mp3"/);
  assert.match(html, /<iframe[^>]+src="https:\/\/archive\.org\/embed\/x"/);
  assert.match(html, /Recuerdo…/);
  assert.equal((html.match(/class="cr-voz"/g) || []).length, 2);
});
```

- [ ] **Step 2: Run** `node --test tests/history-render.test.js` → new test FAILS (`renderVoces` not exported).

- [ ] **Step 3: Implement** — append to `scripts/lib/history-render.js`:

```js
export function renderVoces(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const intro = (data.intro && data.intro[lang]) || '';
  const items = data.items || [];
  let inner;
  if (!items.length) {
    inner = '<p class="cr-empty">' + esc((data.empty && data.empty[lang]) || '') + '</p>';
  } else {
    inner = items.map(v => {
      const speaker = esc((v.speaker && v.speaker[lang]) || '');
      const player = v.kind === 'embed'
        ? '<iframe class="cr-voz-embed" src="' + esc(v.audioSrc) + '" loading="lazy" allow="encrypted-media" title="' + speaker + '"></iframe>'
        : '<audio class="cr-voz-audio" controls preload="none" src="' + esc(v.audioSrc) + '"></audio>';
      const transcript = esc((v.transcript && v.transcript[lang]) || '');
      return '<figure class="cr-voz">' +
        (speaker ? '<figcaption class="cr-voz-by">' + speaker + '</figcaption>' : '') +
        player +
        (transcript ? '<details class="cr-voz-tr"><summary>' + (lang === 'es' ? 'Transcripción' : 'Transcript') + '</summary><p>' + transcript + '</p></details>' : '') +
        '</figure>';
    }).join('');
  }
  return '<h2>' + esc(heading) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '<div class="cr-voces-list">' + inner + '</div>';
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(history): renderVoces helper`.

---

## Task 2: `renderFotos` (dependency-free then/now)

**Files:** Modify `scripts/lib/history-render.js`, `tests/history-render.test.js`

- [ ] **Step 1: Append the failing test**:

```js
import { renderFotos } from '../scripts/lib/history-render.js';

test('renderFotos: empty -> CTA; pair -> juxta slider markup + captions', () => {
  const empty = renderFotos({ heading: { en: 'Then & now', es: 'Antes y ahora' }, intro: { en: '', es: '' }, empty: { en: 'Send a photo', es: 'Envía una foto' }, pairs: [] }, 'es');
  assert.match(empty, /Antes y ahora/);
  assert.match(empty, /Envía una foto/);
  assert.doesNotMatch(empty, /cr-juxta/);

  const data = { heading: { en: 'T', es: 'T' }, intro: { en: '', es: '' }, empty: { en: '', es: '' },
    pairs: [{ id: 'p1', then: { src: '/family-photos/plaza-1950.jpg', year: '1950', caption: { en: 'Plaza', es: 'La plaza' } }, now: { src: '/family-photos/plaza-now.jpg', caption: { en: 'Today', es: 'Hoy' } } }] };
  const html = renderFotos(data, 'es');
  assert.match(html, /class="cr-juxta"/);
  assert.match(html, /plaza-1950\.jpg/);
  assert.match(html, /plaza-now\.jpg/);
  assert.match(html, /La plaza/);
  assert.match(html, /type="range"/);
});
```

- [ ] **Step 2: Run** → FAILS. **Step 3: Implement** — append to `scripts/lib/history-render.js`:

```js
export function renderFotos(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const intro = (data.intro && data.intro[lang]) || '';
  const pairs = data.pairs || [];
  let inner;
  if (!pairs.length) {
    inner = '<p class="cr-empty">' + esc((data.empty && data.empty[lang]) || '') + '</p>';
  } else {
    inner = pairs.map(p => {
      const thenCap = esc((p.then.caption && p.then.caption[lang]) || '');
      const nowCap = esc((p.now.caption && p.now.caption[lang]) || '');
      const year = esc(p.then.year || '');
      return '<figure class="cr-juxta-fig">' +
        '<div class="cr-juxta" role="group" aria-label="' + thenCap + '">' +
          '<img class="cr-juxta-now" src="' + esc(p.now.src) + '" alt="' + nowCap + '" />' +
          '<div class="cr-juxta-then"><img src="' + esc(p.then.src) + '" alt="' + thenCap + '" /></div>' +
          '<input class="cr-juxta-range" type="range" min="0" max="100" value="50" aria-label="' + (lang === 'es' ? 'Comparar antes y ahora' : 'Compare then and now') + '" />' +
        '</div>' +
        '<figcaption>' + (year ? '<strong>' + year + '</strong> · ' : '') + thenCap + (nowCap ? ' → ' + nowCap : '') + '</figcaption>' +
        '</figure>';
    }).join('');
  }
  return '<h2>' + esc(heading) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '<div class="cr-fotos-list">' + inner + '</div>';
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(history): renderFotos dependency-free then/now`.

---

## Task 3: Validators + seed content

**Files:** Create `scripts/lib/history-media.js`, `tests/history-media.test.js`, `content/history/voces.json`, `content/history/fotos.json`

- [ ] **Step 1: Failing test** — create `tests/history-media.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoces, validateFotos } from '../scripts/lib/history-media.js';

test('validateVoces: ok, dup id, bad kind, non-bilingual transcript', () => {
  const v = (o = {}) => ({ id: 'v1', kind: 'file', audioSrc: '/a.mp3', transcript: { en: 'x', es: 'y' }, ...o });
  assert.equal(validateVoces({ items: [v(), v({ id: 'v2', kind: 'embed' })] }).valid, true);
  assert.equal(validateVoces({ items: [v(), v()] }).valid, false);
  assert.equal(validateVoces({ items: [v({ kind: 'nope' })] }).valid, false);
  assert.equal(validateVoces({ items: [v({ transcript: { en: 'x' } })] }).valid, false);
  assert.equal(validateVoces({ items: [] }).valid, true); // empty is valid
});

test('validateFotos: ok, dup id, missing src, non-bilingual caption', () => {
  const p = (o = {}) => ({ id: 'p1', then: { src: '/t.jpg', caption: { en: 'a', es: 'b' } }, now: { src: '/n.jpg', caption: { en: 'a', es: 'b' } }, ...o });
  assert.equal(validateFotos({ pairs: [p(), p({ id: 'p2' })] }).valid, true);
  assert.equal(validateFotos({ pairs: [p(), p()] }).valid, false);
  assert.equal(validateFotos({ pairs: [p({ then: { src: '', caption: { en: 'a', es: 'b' } } })] }).valid, false);
  assert.equal(validateFotos({ pairs: [] }).valid, true);
});
```

- [ ] **Step 2: Run** → FAILS. **Step 3: Implement** — create `scripts/lib/history-media.js`:

```js
const bilingual = (v) => v && typeof v === 'object' && typeof v.en === 'string' && typeof v.es === 'string';

export function validateVoces(data) {
  const errors = [];
  const items = (data && Array.isArray(data.items)) ? data.items : null;
  if (!items) return { valid: false, errors: ['voces.items must be an array'] };
  const seen = new Set();
  for (const v of items) {
    if (!v.id || typeof v.id !== 'string') { errors.push('voz missing id'); continue; }
    if (seen.has(v.id)) errors.push(`duplicate voz id: ${v.id}`);
    seen.add(v.id);
    if (v.kind !== 'file' && v.kind !== 'embed') errors.push(`${v.id}: kind must be file|embed`);
    if (typeof v.audioSrc !== 'string' || !v.audioSrc) errors.push(`${v.id}: audioSrc required`);
    if (!bilingual(v.transcript)) errors.push(`${v.id}: transcript must have en+es`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateFotos(data) {
  const errors = [];
  const pairs = (data && Array.isArray(data.pairs)) ? data.pairs : null;
  if (!pairs) return { valid: false, errors: ['fotos.pairs must be an array'] };
  const seen = new Set();
  for (const p of pairs) {
    if (!p.id || typeof p.id !== 'string') { errors.push('pair missing id'); continue; }
    if (seen.has(p.id)) errors.push(`duplicate pair id: ${p.id}`);
    seen.add(p.id);
    for (const side of ['then', 'now']) {
      if (!p[side] || typeof p[side].src !== 'string' || !p[side].src) errors.push(`${p.id}: ${side}.src required`);
      if (!p[side] || !bilingual(p[side].caption)) errors.push(`${p.id}: ${side}.caption must have en+es`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run** → PASS (2 tests). **Step 5: Create seed content** (empty, with CTAs):

`content/history/voces.json`:
```json
{
  "heading": { "en": "Voices", "es": "Voces" },
  "intro": { "en": "Recordings of the people who lived this history — in their own words.", "es": "Grabaciones de quienes vivieron esta historia — en sus propias palabras." },
  "empty": { "en": "No voices yet. If you have an elder with stories of San José de Gracia, record them — see “Share a memory” below.", "es": "Aún no hay voces. Si tienes un abuelo o abuela con historias de San José de Gracia, grábalas — ve «Comparte una memoria» más abajo." },
  "items": []
}
```

`content/history/fotos.json`:
```json
{
  "heading": { "en": "Then &amp; now", "es": "Antes y ahora" },
  "intro": { "en": "The town across time — drag the slider to compare.", "es": "El pueblo a través del tiempo — desliza para comparar." },
  "empty": { "en": "No photo pairs yet. Have an old photo of the plaza, the church, or a rancho? Send it — see “Share a memory” below.", "es": "Aún no hay pares de fotos. ¿Tienes una foto antigua de la plaza, la iglesia o un rancho? Envíala — ve «Comparte una memoria» más abajo." },
  "pairs": []
}
```

- [ ] **Step 6: Verify seeds validate**:
```bash
node --input-type=module -e "Promise.all([import('./scripts/lib/history-media.js'),import('node:fs')]).then(([m,fs])=>{const V=JSON.parse(fs.readFileSync('content/history/voces.json','utf8'));const F=JSON.parse(fs.readFileSync('content/history/fotos.json','utf8'));console.log('voces',m.validateVoces(V),'fotos',m.validateFotos(F));})"
```
Expected: both `{ valid: true, errors: [] }`.

- [ ] **Step 7: Commit** `feat(history): voces/fotos validators + empty seed content`.

---

## Task 4: Colabora content + template sections + slider JS + build wiring + page tests

**Files:** Modify `content/pages/history.json`, `templates/pages/history.html`, `scripts/build.js`, `tests/history-page.test.js`

- [ ] **Step 1: Add `colabora` to `content/pages/history.json`** (sibling of `sources`, before it):

```json
"colabora": {
  "h2": { "en": "Share a memory", "es": "Comparte una memoria" },
  "body": {
    "en": "<p>This chronicle grows with the community. If you have <strong>old photos</strong>, <strong>documents</strong>, or <strong>stories</strong> — especially elders' memories — they belong here.</p><p><strong>Record an elder on a phone:</strong> sit together with a box of old photos, open your phone's voice recorder, and just let them talk. Five minutes is plenty. Then send the audio or photos and we'll add them, with credit.</p>",
    "es": "<p>Esta crónica crece con la comunidad. Si tienes <strong>fotos antiguas</strong>, <strong>documentos</strong> o <strong>historias</strong> — sobre todo recuerdos de los mayores — aquí tienen su lugar.</p><p><strong>Graba a un abuelo con el teléfono:</strong> siéntate con una caja de fotos viejas, abre la grabadora de voz del teléfono y deja que hable. Cinco minutos bastan. Luego envía el audio o las fotos y las agregamos, con su crédito.</p>"
  },
  "whatsapp_url": { "en": "https://wa.me/523316963003", "es": "https://wa.me/523316963003" },
  "whatsapp_label": { "en": "Send by WhatsApp", "es": "Enviar por WhatsApp" }
}
```

- [ ] **Step 2: Add the three sections** to `templates/pages/history.html`. After `<section class="cr-historias" …>` and before `<section class="cr-sources" …>`:

```html
  <section class="cr-voces" id="sec-voces">{{voces.body}}</section>
  <section class="cr-fotos" id="sec-fotos">{{fotos.body}}</section>
  <section class="cr-colabora" id="sec-colabora">
    <h2>{{colabora.h2}}</h2>
    {{colabora.body}}
    <p class="cr-colabora-cta"><a class="cr-pdf" href="{{colabora.whatsapp_url}}">{{colabora.whatsapp_label}}</a></p>
  </section>
```

- [ ] **Step 3: Add CSS** (in the `<style>` block, near the other `.cr-*` rules):

```css
  .cr-voces, .cr-fotos, .cr-colabora { margin: 2.6rem 0; }
  .cr-voces h2, .cr-fotos h2, .cr-colabora h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 500; margin-bottom: .8rem; color: var(--dark); }
  .cr-empty { color: rgba(28,19,9,.6); font-style: italic; background: #faf6ef; border-radius: 8px; padding: 1rem; }
  .cr-voz { margin: 0 0 1.4rem; }
  .cr-voz-by { font-weight: 600; color: var(--clay); margin-bottom: .35rem; }
  .cr-voz-audio { width: 100%; }
  .cr-voz-embed { width: 100%; height: 80px; border: 0; }
  .cr-voz-tr { margin-top: .4rem; font-size: .92rem; }
  .cr-juxta-fig { margin: 0 0 1.4rem; }
  .cr-juxta { position: relative; max-width: 640px; aspect-ratio: 3/2; overflow: hidden; border-radius: 10px; }
  .cr-juxta img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cr-juxta-then { position: absolute; inset: 0; width: 50%; overflow: hidden; border-right: 2px solid #fff; }
  .cr-juxta-then img { width: 200%; max-width: none; }
  .cr-juxta-range { position: absolute; bottom: 8px; left: 8px; right: 8px; width: calc(100% - 16px); }
  .cr-colabora-cta { margin-top: 1rem; }
```

- [ ] **Step 4: Add the dependency-free slider script** just before the closing of the `<div class="cr-wrap">` body (or after the sections). Add this `<script>` to `templates/pages/history.html`:

```html
<script>
  document.querySelectorAll('.cr-juxta').forEach(function (j) {
    var range = j.querySelector('.cr-juxta-range');
    var then = j.querySelector('.cr-juxta-then');
    var img = then && then.querySelector('img');
    if (!range || !then) return;
    function apply() { var p = range.value; then.style.width = p + '%'; if (img) img.style.width = (10000 / Math.max(p, 1)) + '%'; }
    range.addEventListener('input', apply); apply();
  });
</script>
```

- [ ] **Step 5: Wire the build** — in `scripts/build.js`, extend the `if (pageName === 'history')` block (add imports `renderVoces, renderFotos` from history-render and `validateVoces, validateFotos` from history-media):

```js
    const voces = await loadContent(join(ROOT, 'content/history/voces.json'));
    const fotos = await loadContent(join(ROOT, 'content/history/fotos.json'));
    const vv = validateVoces(voces); if (!vv.valid) throw new Error('invalid voces.json: ' + vv.errors.join('; '));
    const vf = validateFotos(fotos); if (!vf.valid) throw new Error('invalid fotos.json: ' + vf.errors.join('; '));
    content.voces = { body: { en: renderVoces(voces, 'en'), es: renderVoces(voces, 'es') } };
    content.fotos = { body: { en: renderFotos(fotos, 'en'), es: renderFotos(fotos, 'es') } };
```
(Add these alongside the existing `content.timeline.body` / `content.historias` lines.)

- [ ] **Step 6: Extend `tests/history-page.test.js`** — mirror the new injection in `buildHistory` (load voces.json + fotos.json, validate, set `content.voces.body`/`content.fotos.body`), import the new renderers/validators, and add:

```js
test('built history page renders Voces, Fotos, and Colabora with empty states + WhatsApp', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    assert.match(html, /id="sec-voces"/);
    assert.match(html, /id="sec-fotos"/);
    assert.match(html, /id="sec-colabora"/);
    assert.match(html, /class="cr-empty"/); // empty states render
    assert.match(html, /https:\/\/wa\.me\/523316963003/);
  }
});
```

- [ ] **Step 7: Build + full suite**:
```bash
node scripts/build.js >/dev/null 2>&1 && echo BUILD_OK
node --test --test-concurrency=1 2>&1 | tail -6
grep -c 'id="sec-voces"\|id="sec-fotos"\|id="sec-colabora"' dist/es/historia.html
```
Expected: BUILD_OK; all pass, 0 fail; grep ≥ 3.

- [ ] **Step 8: Commit** `feat(history): Voces + Fotos + Colabora sections on La Crónica`.

---

## Task 5: Preview + review gate

- [ ] Push `feature/history-phase2`; get the real preview URL from the Vercel deployment list (branch alias is hashed); wait for READY.
- [ ] Browser-verify `/es/historia` + `/en/history`: Voces + Fotos show inviting empty-state CTAs; the Colabora section shows the record-an-elder guide + a working WhatsApp link; no console errors; print still clean.
- [ ] Summarize; **pause for Jaime's review** (do not merge). On approval: finishing-a-development-branch → merge `--no-ff`, push, confirm prod READY, update the Memory Bank.

---

## Self-Review

**Spec coverage:** Voces (model+validator+render+section+empty) → Tasks 1,3,4 ✓; Fotos then/now dep-free slider → Tasks 2,3,4 ✓; flexible audio src (file/embed) → Task 1 player branch ✓; contact-based contribution (Colabora + WhatsApp) → Task 4 ✓; bilingual ✓; tests (render, media, page) ✓; gate → Task 5 ✓.

**Placeholder scan:** all code/content shown in full; seeds are real (empty arrays + real bilingual CTA copy + real WhatsApp). No TBD.

**Type consistency:** `renderVoces(data,lang)`/`renderFotos(data,lang)` read `{en,es}` leaves + `items`/`pairs`; build passes raw objects (pre-resolveLang). `validateVoces`/`validateFotos` → `{valid,errors}` used in build + tests. Injected `content.voces.body`/`content.fotos.body` match `{{voces.body}}`/`{{fotos.body}}`; `colabora.*` tokens match the content block. Slider classes (`.cr-juxta`, `.cr-juxta-then`, `.cr-juxta-range`) match between `renderFotos` markup, CSS, and the script.
