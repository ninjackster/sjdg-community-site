# History Showpiece — *La Crónica de San José de Gracia* — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin `/history` page with an extensive, bilingual, show-off-worthy long-form history of San José de Gracia that also prints to a watermarked PDF, branded "Compilado por Jaime Murillo."

**Architecture:** All content lives in `content/pages/history.json` (expanded to the verified 12-section structure). `templates/pages/history.html` renders it long-form and carries a `@media print` stylesheet + a `window.print()` button so the same page is the PDF. Verified facts come from the deep-research dossier; the refuted "1793 / 1,980 m" claims are corrected in both the page and the `base.html` JSON-LD. Approach A — print CSS, **no new dependencies**.

**Tech Stack:** The repo's static build (`scripts/build.js` → `buildPage` → `{{token}}` render via `scripts/lib/render.js`, which THROWS on unresolved tokens and does NOT loop). `node --test`. Bilingual `{en,es}` content leaves resolved by `scripts/lib/content.js`.

**Spec:** `docs/superpowers/specs/2026-05-30-history-showpiece-design.md`
**Branch:** `feature/history-showpiece` (off `main`)

---

## Key facts (verified — use these verbatim; do NOT invent beyond them)

Source of truth: `~/Downloads/Histtoria /San-Jose-de-Gracia-Jalisco-dossier-historico.md` (note trailing space in folder).

- Identity: locality + **delegación política** of **Tepatitlán de Morelos, Jalisco**; INEGI **140930291**; region **Altos Sur** (IIEG 03). Delegación since **1939**; comisaría before. NOT Michoacán. `[HIGH]`
- Geography: SW extreme of the municipality, **~26 km SW of the cabecera**, **~95 km NE of Guadalajara**; altitude **~1,900 m (INEGI 1,907 m)**; coords 20°40′30″N 102°34′15″O; dry/semi-dry, mean **~25 °C**; **one of the most humid zones in the Altos**. `[HIGH]`
- Economy: **maize, beans, agave** + **cattle ranching** (milk & meat); municipality ~9,000 ha agave. `[HIGH]`
- Population: **5,128 (2000) · 4,910 (2005) · 5,190 (2010) · 5,441 (2020)**; **3rd-largest locality** in the municipality (after Tepatitlán ~98,842 and Capilla de Guadalupe ~13,308); ~96.7% Catholic. `[HIGH]`
- Origins: **Hacienda de San José de Gracia**, tied to the **Hernández family** (testaments of Antonio Rafael & José María Hernández in the Tepatitlán archive), lands **"El Bramido"/"Bramadero"** (maize & mezcal); **late 18th–early 19th century**. The specific "founded 1793 by the Hernández Padilla brothers, first chapel 1822" story was **refuted (0-3)**. `[MEDIUM]`
- Administrative arc: **1857** the *vecinos de San José de Gracia* appear in Tepatitlán road proceedings; **1860s** under the **Cantón/Prefectura de La Barca** (with Capilla de Guadalupe & Cañadas/Temacapulín); Tepatitlán in the **Tercer Cantón (capital La Barca)** until cantonal organization was abolished in the early 20th c. The **1897 *Geografía Particular del Estado de Jalisco*** (Prof. José M. Nájar Herrera) lists San José de Gracia as a **comisaría of Tepatitlán de Morelos** (with Capilla de Guadalupe and San José Basarte) in the **Cantón de La Barca**. `[HIGH]`
- Faith: dedicated to **San José**; earlier **capellanía** (1833 censo); current **cantera-roja/riolita** church begun **1889**, erected **parish 1910**, first priest **Fermín Padilla** (dates `[MEDIUM]`, single source; dedication `[HIGH]`).
- Cristero (1926–29): Los Altos was the heartland; SJdG's Catholic identity fits — but **no locality-specific events/figures survived verification** (open question → Tepatitlán archive, Arquidiócesis de Guadalajara). `[regional HIGH / local OPEN]`
- Culture: **fiestas patronales each May**; **Delegación Municipal** (220 m²), **Cruz Roja subdelegación** (6 beds); grouped with San Ignacio Cerro Gordo. `[HIGH]`

---

## File Structure

- **Modify** `content/pages/history.json` — replace `hero` + `sections` with the verified long-form structure below; add `byline`, `sources`, and a `pdf` button label; correct `meta`. Keep `rental` and `cross_links` intact.
- **Rewrite** `templates/pages/history.html` — long-form layout + `@media print` block + Download-PDF button + byline/watermark. (Render has no loops, so each section is its own `{{token}}`; rich markup lives inside the JSON string values, which render inserts as-is.)
- **Modify** `templates/layouts/base.html` — fix the JSON-LD description ("Founded in 1793 at 1,980 m" → corrected) and optionally add `author`.
- **Create** `tests/history-page.test.js` — assert facts corrected, byline present, print affordances present, all sections render, sources listed, no unresolved tokens.

No new image assets (book scans deferred); reuse existing `church-hero.jpg` / `pueblo-1.webp` only if the template references them. `page-slugs.json` and sitemap unchanged (page stays public/indexable).

---

## PR 1 — Accuracy fix in the site-wide schema

### Task 1: Correct the base-layout JSON-LD

**Files:** Modify `templates/layouts/base.html`; Test: `tests/history-page.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/history-page.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('base.html schema no longer asserts 1,980 m or "Founded in 1793"', async () => {
  const base = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  assert.doesNotMatch(base, /1,980\s*m/i);
  assert.doesNotMatch(base, /Founded in 1793/i);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node --test tests/history-page.test.js`
Expected: FAIL (base.html currently contains "Founded in 1793 at 1,980 m elevation").

- [ ] **Step 3: Fix the schema description**

In `templates/layouts/base.html`, find the `"description"` field in the TouristDestination/Place JSON-LD (it reads, in part, "Founded in 1793 at 1,980 m elevation — cobblestone streets…"). Replace that description string with:

```
"A historic highland town in the Altos de Jalisco, México — a delegación of Tepatitlán de Morelos with roots in the late 18th century, set at about 1,900 m elevation. Cobblestone streets, the Parroquia de San José, mezcal, and unhurried warmth 95 km from Guadalajara."
```

(If a `geo`/elevation or other field also hardcodes 1,980, leave coordinates as-is — only the prose elevation/founding claims change.)

- [ ] **Step 4: Run it, expect PASS**

Run: `node --test tests/history-page.test.js`
Expected: PASS.

- [ ] **Step 5: Build + full suite**

Run: `npm run build && npm test`
Expected: build OK; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add templates/layouts/base.html tests/history-page.test.js
git commit -m "fix: correct site schema (drop refuted 1793 / 1,980m claims)"
```

---

## PR 2 — Long-form bilingual content

### Task 2: Replace history.json content

**Files:** Modify `content/pages/history.json`; Test: extend `tests/history-page.test.js`

- [ ] **Step 1: Write the failing assertions** — APPEND to `tests/history-page.test.js`:

```javascript
import { loadContent } from '../scripts/lib/content.js';

test('history content is corrected, bylined, and sourced', async () => {
  const c = await loadContent(join(ROOT, 'content/pages/history.json'));
  const json = JSON.stringify(c);
  // facts corrected
  assert.doesNotMatch(json, /Founded in 1793|Fundado en 1793|1,980/);
  assert.match(json, /1,907|1,900/);
  // byline present (both langs)
  assert.match(c.byline.en, /Compilado por Jaime Murillo/);
  assert.match(c.byline.es, /Compilado por Jaime Murillo/);
  // all 9 narrative sections present
  for (const k of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897']) {
    assert.ok(c.sections[k] && c.sections[k].h2 && c.sections[k].body, `missing section ${k}`);
  }
  // sources block present with at least 4 items rendered as HTML list
  assert.match(c.sources.body.en, /<li/);
  assert.ok((c.sources.body.en.match(/<li/g) || []).length >= 4);
  // pdf button label present
  assert.ok(c.pdf.label.en && c.pdf.label.es);
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node --test tests/history-page.test.js`
Expected: FAIL (no `byline`, new sections, `sources`, or `pdf` keys yet).

- [ ] **Step 3: Replace `content/pages/history.json`** with the following. Keep the existing `rental` block byte-for-byte (copy it from the current file). Write the full file:

```json
{
  "meta": {
    "slug":        { "en": "history", "es": "historia" },
    "title":       { "en": "History of San José de Gracia, Jalisco — A Highland Chronicle",
                     "es": "Historia de San José de Gracia, Jalisco — Una crónica de los Altos" },
    "description": { "en": "An extensive history of San José de Gracia, Jalisco: a delegación of Tepatitlán de Morelos in Los Altos, with roots in a late-18th-century hacienda — its parish, ranching economy, demographics, and the 1897 record.",
                     "es": "Una historia extensa de San José de Gracia, Jalisco: delegación de Tepatitlán de Morelos en los Altos, con raíces en una hacienda de fines del siglo XVIII — su parroquia, su economía ganadera, su demografía y el registro de 1897." },
    "og_locale_primary":   { "en": "en_US", "es": "es_MX" },
    "og_locale_alternate": { "en": "es_MX", "es": "en_US" }
  },
  "hero": {
    "kicker": { "en": "A Highland Chronicle", "es": "Una crónica de los Altos" },
    "h1":    { "en": "La Crónica de <em>San José de Gracia</em>",
               "es": "La Crónica de <em>San José de Gracia</em>" },
    "intro": { "en": "High in the Altos Sur of Jalisco, about 95 kilometers northeast of Guadalajara, San José de Gracia sits at roughly 1,900 meters above sea level — a ranchero town of maize, agave, and cattle whose roots reach back to a late-18th-century hacienda. This is its story, drawn from municipal archives, the 1897 <em>Geografía Particular del Estado de Jalisco</em>, and the public record.",
               "es": "En lo alto de los Altos Sur de Jalisco, a unos 95 kilómetros al noreste de Guadalajara, San José de Gracia se asienta a unos 1,900 metros sobre el nivel del mar — un pueblo ranchero de maíz, agave y ganado cuyas raíces se remontan a una hacienda de fines del siglo XVIII. Esta es su historia, reunida de archivos municipales, la <em>Geografía Particular del Estado de Jalisco</em> de 1897 y el registro público." }
  },
  "byline": {
    "en": "Compilado por Jaime Murillo · 2026",
    "es": "Compilado por Jaime Murillo · 2026"
  },
  "pdf": {
    "label": { "en": "Download PDF", "es": "Descargar PDF" }
  },
  "sections": {
    "place": {
      "h2": { "en": "Land &amp; place", "es": "Tierra y lugar" },
      "body": {
        "en": "<p>San José de Gracia is a locality and <strong>political delegación of Tepatitlán de Morelos</strong>, in the <strong>Altos Sur</strong> region of Jalisco (its INEGI locality code, 140930291, fixes it firmly in Jalisco — not the Michoacán town of the same name). It lies at the southwestern edge of the municipality, about 26 kilometers from the cabecera and some 95 kilometers northeast of Guadalajara.</p><p>The town rests at roughly <strong>1,900 meters</strong> above sea level (INEGI gives 1,907 m), with a dry, temperate highland climate averaging about 25&nbsp;°C. It is, by the state's own planning record, one of the most humid zones in all of Los Altos.</p>",
        "es": "<p>San José de Gracia es una localidad y <strong>delegación política de Tepatitlán de Morelos</strong>, en la región <strong>Altos Sur</strong> de Jalisco (su código de localidad INEGI, 140930291, lo ubica con certeza en Jalisco — no el pueblo homónimo de Michoacán). Se encuentra en el extremo suroeste del municipio, a unos 26 kilómetros de la cabecera y unos 95 kilómetros al noreste de Guadalajara.</p><p>El pueblo se asienta a unos <strong>1,900 metros</strong> sobre el nivel del mar (INEGI registra 1,907 m), con un clima templado y seco de altura que promedia unos 25&nbsp;°C. Es, según el propio plan estatal, una de las zonas más húmedas de todos los Altos.</p>"
      }
    },
    "origins": {
      "h2": { "en": "Origins: the hacienda", "es": "Orígenes: la hacienda" },
      "body": {
        "en": "<p>The town grew out of the <strong>Hacienda de San José de Gracia</strong>, tied to the <strong>Hernández family</strong> — the testaments of Antonio Rafael Hernández and José María Hernández survive in the Tepatitlán municipal archive — on lands historically known as <em>El Bramido</em> (or <em>Bramadero</em>), a country of maize and mezcal. The best-supported dating places the settlement's consolidation in the <strong>late 18th to early 19th century</strong>.</p><p>A founding year of 1793 is popularly repeated, but the precise story of four Hernández Padilla brothers founding the town that year (with a first chapel in 1822) is <strong>not borne out by the documentary record</strong> — so the honest framing is a hacienda-born community that took shape around the turn of the 19th century.</p>",
        "es": "<p>El pueblo surgió de la <strong>Hacienda de San José de Gracia</strong>, ligada a la <strong>familia Hernández</strong> — los testamentos de Antonio Rafael Hernández y José María Hernández se conservan en el archivo municipal de Tepatitlán — en tierras conocidas como <em>El Bramido</em> (o <em>Bramadero</em>), una comarca de maíz y mezcal. La datación mejor sustentada sitúa la consolidación del asentamiento a <strong>fines del siglo XVIII o principios del XIX</strong>.</p><p>Se repite popularmente el año de fundación de 1793, pero la historia precisa de cuatro hermanos Hernández Padilla fundando el pueblo ese año (con una primera capilla en 1822) <strong>no se sostiene en el registro documental</strong> — así que lo honesto es hablar de una comunidad de origen hacendario que tomó forma hacia el cambio del siglo XIX.</p>"
      }
    },
    "administrative": {
      "h2": { "en": "From Nueva Galicia to delegación", "es": "De la Nueva Galicia a la delegación" },
      "body": {
        "en": "<p>By <strong>1857</strong> the <em>vecinos de San José de Gracia</em> were named in Tepatitlán's municipal road proceedings; through the 1860s the place sat under the old <strong>Cantón / Prefectura de La Barca</strong>, the same higher unit that grouped Capilla de Guadalupe and the Cañadas–Temacapulín country. Tepatitlán belonged to the <strong>Tercer Cantón</strong>, with its capital at La Barca, until the cantonal system was abolished in the early 20th century.</p><p>The town appears by name in the <strong>1897 <em>Geografía Particular del Estado de Jalisco</em></strong> by Prof. José M. Nájar Herrera, which lists San José de Gracia as a <strong>comisaría of Tepatitlán de Morelos</strong> — alongside Capilla de Guadalupe and San José Basarte — within the Cantón de La Barca. It became a formal <strong>Delegación Política in 1939</strong>.</p>",
        "es": "<p>Para <strong>1857</strong> los <em>vecinos de San José de Gracia</em> figuraban en las diligencias de caminos del municipio de Tepatitlán; durante la década de 1860 el lugar dependía del antiguo <strong>Cantón / Prefectura de La Barca</strong>, la misma unidad que agrupaba a Capilla de Guadalupe y la comarca de las Cañadas–Temacapulín. Tepatitlán pertenecía al <strong>Tercer Cantón</strong>, con capital en La Barca, hasta que el sistema cantonal se abolió a principios del siglo XX.</p><p>El pueblo aparece por su nombre en la <strong><em>Geografía Particular del Estado de Jalisco</em> de 1897</strong>, del Prof. José M. Nájar Herrera, que enlista a San José de Gracia como <strong>comisaría de Tepatitlán de Morelos</strong> — junto con Capilla de Guadalupe y San José Basarte — dentro del Cantón de La Barca. Se constituyó como <strong>Delegación Política en 1939</strong>.</p>"
      }
    },
    "faith": {
      "h2": { "en": "Faith &amp; the parish", "es": "Fe y parroquia" },
      "body": {
        "en": "<p>The town is dedicated to <strong>San José</strong>. An earlier chaplaincy (<em>capellanía</em>) at San José de Gracia is documented in the Tepatitlán archive (with an 1833 <em>censo de capellanías</em>). The present parish church — built of local <strong>cantera roja</strong> and riolita — is reported to have begun construction in <strong>1889</strong> and to have been erected as a parish on <strong>May 15, 1910</strong>, under its first priest, Fermín Padilla. (These specific dates rest on a single local source and await confirmation against primary parish books.)</p>",
        "es": "<p>El pueblo está dedicado a <strong>San José</strong>. Se documenta una <em>capellanía</em> anterior en San José de Gracia en el archivo de Tepatitlán (con un <em>censo de capellanías</em> de 1833). El templo parroquial actual — de <strong>cantera roja</strong> y riolita locales — habría iniciado su construcción en <strong>1889</strong> y habría sido erigido en parroquia el <strong>15 de mayo de 1910</strong>, bajo su primer párroco, Fermín Padilla. (Estas fechas concretas descansan en una sola fuente local y están pendientes de confirmar en libros parroquiales primarios.)</p>"
      }
    },
    "cristero": {
      "h2": { "en": "The Cristero era", "es": "La Cristiada" },
      "body": {
        "en": "<p>Los Altos de Jalisco was the heartland of the <strong>Cristero War (1926–1929)</strong>, the armed Catholic uprising against the government's anti-clerical laws, and San José de Gracia's deeply Catholic, ranchero character — the locality was about 96.7% Catholic as of 2020 — places it squarely in that world. Honesty requires a caveat: while the regional context is well established, <strong>no locality-specific Cristero event or figure for San José de Gracia survived archive-grade verification</strong>. Those stories likely await a researcher in the Tepatitlán municipal archive and the records of the Arquidiócesis de Guadalajara.</p>",
        "es": "<p>Los Altos de Jalisco fueron el corazón de la <strong>Guerra Cristera (1926–1929)</strong>, el levantamiento católico armado contra las leyes anticlericales del gobierno, y el carácter profundamente católico y ranchero de San José de Gracia — la localidad era cerca de 96.7% católica en 2020 — lo sitúa de lleno en ese mundo. La honestidad obliga a una advertencia: aunque el contexto regional está bien establecido, <strong>ningún evento o figura cristera específica de San José de Gracia resistió la verificación a nivel de archivo</strong>. Esas historias probablemente esperan a quien investigue en el archivo municipal de Tepatitlán y en los registros de la Arquidiócesis de Guadalajara.</p>"
      }
    },
    "economy": {
      "h2": { "en": "Land &amp; work", "es": "Tierra y trabajo" },
      "body": {
        "en": "<p>The local economy is the classic Altos blend: <strong>maize, beans, and agave</strong> in the fields, and <strong>cattle ranching</strong> for milk and meat. The wider municipality cultivates on the order of 9,000 hectares of agave. Good soils and that unusual highland humidity have long made this a productive corner of the region.</p>",
        "es": "<p>La economía local es la mezcla clásica de los Altos: <strong>maíz, frijol y agave</strong> en el campo, y <strong>ganadería bovina</strong> para leche y carne. El municipio en su conjunto cultiva del orden de 9,000 hectáreas de agave. Los buenos suelos y esa humedad inusual de altura han hecho de este un rincón productivo de la región.</p>"
      }
    },
    "people": {
      "h2": { "en": "The people", "es": "La gente" },
      "body": {
        "en": "<p>San José de Gracia is the <strong>third most populous locality</strong> in the municipality of Tepatitlán, after the cabecera and Capilla de Guadalupe. Its population across recent censuses: <strong>5,128 (2000), 4,910 (2005), 5,190 (2010), and 5,441 (2020)</strong> — modest, steady growth with a mid-2000s dip. Like much of Los Altos, the town is also a significant sender of migrants to the United States; the binational ties are part of daily life, though locality-specific migration figures remain to be documented.</p>",
        "es": "<p>San José de Gracia es la <strong>tercera localidad más poblada</strong> del municipio de Tepatitlán, después de la cabecera y de Capilla de Guadalupe. Su población en censos recientes: <strong>5,128 (2000), 4,910 (2005), 5,190 (2010) y 5,441 (2020)</strong> — un crecimiento modesto y constante, con una baja a mediados de los 2000. Como gran parte de los Altos, el pueblo también envía a muchos migrantes a Estados Unidos; los lazos binacionales son parte de la vida diaria, aunque las cifras de migración específicas de la localidad están aún por documentarse.</p>"
      }
    },
    "culture": {
      "h2": { "en": "Fiestas &amp; everyday life", "es": "Fiestas y costumbres" },
      "body": {
        "en": "<p>The <strong>fiestas patronales</strong> fill the town each <strong>May</strong>, drawing back family and visitors. San José de Gracia carries the unmistakable stamp of a Los Altos ranchero town — often spoken of in the same breath as neighboring San Ignacio Cerro Gordo — and keeps a working civic life, with its <strong>Delegación Municipal</strong> and a Red Cross subdelegación serving the community.</p>",
        "es": "<p>Las <strong>fiestas patronales</strong> llenan el pueblo cada <strong>mayo</strong>, atrayendo de regreso a la familia y a los visitantes. San José de Gracia lleva el sello inconfundible de un pueblo ranchero de los Altos — del que se habla a menudo junto con el vecino San Ignacio Cerro Gordo — y mantiene una vida cívica activa, con su <strong>Delegación Municipal</strong> y una subdelegación de la Cruz Roja al servicio de la comunidad.</p>"
      }
    },
    "book1897": {
      "h2": { "en": "The 1897 record", "es": "El registro de 1897" },
      "body": {
        "en": "<p>One of the firmest anchors in this history is a small schoolbook: the <strong><em>Geografía Particular del Estado de Jalisco</em> (1897)</strong> by Prof. José M. Nájar Herrera. On its page 63 it sets down the administrative world of the day — and there, in §260, San José de Gracia is named as a comisaría of Tepatitlán de Morelos:</p><blockquote><em>\"El Departamento de Tepatitlán consta de dos municipalidades… Tepatitlán de Morelos, con tres comisarías: Capilla de Guadalupe, San José de Gracia y San José Basarte…\"</em></blockquote><p>More than a century later, that single line lets us place the town precisely within the vanished Cantón de La Barca.</p>",
        "es": "<p>Uno de los anclajes más firmes de esta historia es un pequeño libro escolar: la <strong><em>Geografía Particular del Estado de Jalisco</em> (1897)</strong>, del Prof. José M. Nájar Herrera. En su página 63 consigna el mundo administrativo de su tiempo — y ahí, en el §260, San José de Gracia aparece nombrado como comisaría de Tepatitlán de Morelos:</p><blockquote><em>\"El Departamento de Tepatitlán consta de dos municipalidades… Tepatitlán de Morelos, con tres comisarías: Capilla de Guadalupe, San José de Gracia y San José Basarte…\"</em></blockquote><p>Más de un siglo después, esa sola línea nos permite ubicar al pueblo con precisión dentro del desaparecido Cantón de La Barca.</p>"
      }
    }
  },
  "sources": {
    "h2": { "en": "Sources &amp; method", "es": "Fuentes y método" },
    "note": {
      "en": "This chronicle was compiled from primary and secondary sources and fact-checked through adversarial verification; confidence levels are noted where the record is thin.",
      "es": "Esta crónica se compiló de fuentes primarias y secundarias y se verificó mediante revisión adversarial; se indican niveles de confianza donde el registro es escaso."
    },
    "body": {
      "en": "<ul><li>Gobierno de Jalisco — SIGA / Plan de Desarrollo Urbano, Localidad de San José de Gracia (2015) <em>[primary]</em></li><li>Archivo Histórico Municipal de Tepatitlán de Morelos <em>[primary]</em></li><li>IIEG Jalisco — Análisis sociodemográfico de San José de Gracia, 2020 <em>[primary]</em></li><li>INEGI census tabulations (via CityPopulation) <em>[secondary]</em></li><li>Nájar Herrera, J. M. — <em>Geografía Particular del Estado de Jalisco</em> (1897) <em>[primary]</em></li><li>Wikipedia / Enciclopedia de los Municipios <em>[secondary]</em></li></ul>",
      "es": "<ul><li>Gobierno de Jalisco — SIGA / Plan de Desarrollo Urbano, Localidad de San José de Gracia (2015) <em>[primaria]</em></li><li>Archivo Histórico Municipal de Tepatitlán de Morelos <em>[primaria]</em></li><li>IIEG Jalisco — Análisis sociodemográfico de San José de Gracia, 2020 <em>[primaria]</em></li><li>Tabulados del censo INEGI (vía CityPopulation) <em>[secundaria]</em></li><li>Nájar Herrera, J. M. — <em>Geografía Particular del Estado de Jalisco</em> (1897) <em>[primaria]</em></li><li>Wikipedia / Enciclopedia de los Municipios <em>[secundaria]</em></li></ul>"
    }
  },
  "cross_links": {
    "h2":           { "en": "More about San José",        "es": "Más sobre San José" },
    "festivals":    { "en": "Festivals and traditions",   "es": "Fiestas y tradiciones" },
    "tour":         { "en": "Walking tour",               "es": "Recorrido a pie" },
    "things_to_do": { "en": "Things to do",               "es": "Qué hacer" }
  },
  "rental": { "PASTE THE EXISTING rental BLOCK FROM THE CURRENT history.json VERBATIM HERE" }
}
```

> **Implementer note:** the `rental` value above is a placeholder marker — copy the real `rental` object verbatim from the current `content/pages/history.json` (do not invent it). Everything else is final.

- [ ] **Step 4: Run the assertions, expect PASS**

Run: `node --test tests/history-page.test.js`
Expected: the content test passes (template test from PR3 may still fail until Task 3 — that's fine; run just this file's content test, or proceed).

- [ ] **Step 5: Commit**

```bash
git add content/pages/history.json tests/history-page.test.js
git commit -m "feat: extensive bilingual history content (verified, sourced, bylined)"
```

---

## PR 3 — Long-form template + print-to-PDF

### Task 3: Rewrite the history template with print CSS

**Files:** Modify `templates/pages/history.html`; Test: extend `tests/history-page.test.js`

- [ ] **Step 1: Write the failing build test** — APPEND to `tests/history-page.test.js`:

```javascript
import { buildPage } from '../scripts/lib/build-page.js';

async function buildHistory(lang) {
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  const tpl = await readFile(join(ROOT, 'templates/pages/history.html'), 'utf8');
  const content = await loadContent(join(ROOT, 'content/pages/history.json'));
  const shared = {
    nav: await loadContent(join(ROOT, 'content/shared/nav.json')),
    footer: await loadContent(join(ROOT, 'content/shared/footer.json')),
    common: await loadContent(join(ROOT, 'content/shared/common.json')),
  };
  const pageSlugs = await loadContent(join(ROOT, 'content/shared/page-slugs.json'));
  return buildPage({ lang, layout, pageTemplate: tpl, content, shared, siteUrl: 'https://sanjosedegracia.net', pageSlugs });
}

test('history page renders long-form with print affordances and no unresolved tokens', async () => {
  const html = await buildHistory('es');
  assert.doesNotMatch(html, /\{\{.*?\}\}/);                 // no unresolved tokens
  assert.match(html, /Compilado por Jaime Murillo/);        // byline
  assert.match(html, /@media print/);                       // print stylesheet
  assert.match(html, /window\.print\(\)/);                  // download-pdf trigger
  for (const id of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897','sources']) {
    assert.match(html, new RegExp(`id="sec-${id}"`), `missing #sec-${id}`);
  }
  assert.match(html, /Descargar PDF/);                      // es pdf label
});
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node --test tests/history-page.test.js`
Expected: FAIL (template still the old version; missing sections/print/byline).

- [ ] **Step 3: Replace `templates/pages/history.html`** with:

```html
<style>
  .cr-wrap { max-width: 820px; margin: 0 auto; padding: 7rem 1.5rem 4rem; }
  .cr-hero { border-bottom: 1px solid var(--mist); padding-bottom: 1.6rem; margin-bottom: 2.4rem; }
  .cr-kicker { font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: var(--clay); margin-bottom: .6rem; }
  .cr-hero h1 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(2rem, 5vw, 3.1rem); line-height: 1.1; margin-bottom: 1rem; }
  .cr-hero h1 em { font-style: italic; color: var(--clay); }
  .cr-lede { font-size: 1.08rem; line-height: 1.75; color: rgba(28,19,9,.78); }
  .cr-byline { margin-top: 1rem; font-size: .85rem; color: rgba(28,19,9,.55); font-style: italic; }
  .cr-actions { margin: 1.4rem 0 0; }
  .cr-pdf { font: inherit; font-size: .85rem; cursor: pointer; background: var(--clay); color: #fff; border: none; border-radius: 6px; padding: .55rem 1.1rem; }
  .cr-section { margin-bottom: 2.6rem; }
  .cr-section h2 { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 500; line-height: 1.3; margin-bottom: .8rem; color: var(--dark); }
  .cr-section p { font-size: 1rem; line-height: 1.8; color: rgba(28,19,9,.8); margin-bottom: 1rem; }
  .cr-section blockquote { border-left: 3px solid var(--clay); margin: 1.2rem 0; padding: .4rem 0 .4rem 1.1rem; color: rgba(28,19,9,.7); }
  .cr-section a { color: var(--clay); }
  .cr-sources { margin-top: 3rem; padding-top: 1.8rem; border-top: 1px solid var(--mist); font-size: .9rem; }
  .cr-sources ul { line-height: 1.7; }
  .cr-cross { margin-top: 2.4rem; padding-top: 1.6rem; border-top: 1px solid var(--mist); }
  .cr-cross ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 1rem; }
  .cr-cross a { color: var(--clay); text-decoration: none; }

  @media print {
    body * { visibility: hidden; }
    .cr-wrap, .cr-wrap * { visibility: visible; }
    .cr-wrap { position: absolute; left: 0; top: 0; max-width: 100%; padding: 1.5cm; }
    .cr-actions, .cr-cross { display: none; }
    .cr-section { page-break-inside: avoid; }
    .cr-section h2 { page-break-after: avoid; }
    /* Diagonal watermark + running footer */
    .cr-wrap::before { content: "Compilado por Jaime Murillo"; position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 3rem; color: rgba(196,120,90,.10); white-space: nowrap; z-index: 0; }
    .cr-wrap::after { content: "La Crónica de San José de Gracia · sanjosedegracia.net"; position: fixed; bottom: .6cm; left: 0; right: 0; text-align: center; font-size: .7rem; color: rgba(28,19,9,.5); }
    a[href]::after { content: ""; } /* don't print raw URLs inline */
  }
</style>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{meta.title}}",
  "description": "{{meta.description}}",
  "inLanguage": "{{lang}}",
  "author": { "@type": "Person", "name": "Jaime Murillo" },
  "isPartOf": { "@type": "WebSite", "name": "{{shared.common.site_name}}", "url": "{{shared.common.site_url}}" },
  "about": { "@type": "Place", "name": "San José de Gracia", "address": { "@type": "PostalAddress", "addressLocality": "San José de Gracia", "addressRegion": "Jalisco", "addressCountry": "MX" } }
}
</script>

<div class="cr-wrap">
  <header class="cr-hero">
    <div class="cr-kicker">{{hero.kicker}}</div>
    <h1>{{hero.h1}}</h1>
    <p class="cr-lede">{{hero.intro}}</p>
    <p class="cr-byline">{{byline}}</p>
    <div class="cr-actions"><button class="cr-pdf" onclick="window.print()">{{pdf.label}}</button></div>
  </header>

  <section class="cr-section" id="sec-place"><h2>{{sections.place.h2}}</h2>{{sections.place.body}}</section>
  <section class="cr-section" id="sec-origins"><h2>{{sections.origins.h2}}</h2>{{sections.origins.body}}</section>
  <section class="cr-section" id="sec-administrative"><h2>{{sections.administrative.h2}}</h2>{{sections.administrative.body}}</section>
  <section class="cr-section" id="sec-faith"><h2>{{sections.faith.h2}}</h2>{{sections.faith.body}}</section>
  <section class="cr-section" id="sec-cristero"><h2>{{sections.cristero.h2}}</h2>{{sections.cristero.body}}</section>
  <section class="cr-section" id="sec-economy"><h2>{{sections.economy.h2}}</h2>{{sections.economy.body}}</section>
  <section class="cr-section" id="sec-people"><h2>{{sections.people.h2}}</h2>{{sections.people.body}}</section>
  <section class="cr-section" id="sec-culture"><h2>{{sections.culture.h2}}</h2>{{sections.culture.body}}</section>
  <section class="cr-section" id="sec-book1897"><h2>{{sections.book1897.h2}}</h2>{{sections.book1897.body}}</section>

  <section class="cr-sources" id="sec-sources">
    <h2>{{sources.h2}}</h2>
    <p>{{sources.note}}</p>
    {{sources.body}}
  </section>

  <nav class="cr-cross">
    <ul>
      <li><a href="{{nav_urls.festivals}}">{{cross_links.festivals}}</a></li>
      <li><a href="{{nav_urls.tour}}">{{cross_links.tour}}</a></li>
      <li><a href="{{nav_urls.things-to-do}}">{{cross_links.things_to_do}}</a></li>
    </ul>
  </nav>
</div>
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `node --test tests/history-page.test.js`
Expected: PASS (all history tests).

- [ ] **Step 5: Full build + suite**

Run: `npm run build && npm test`
Expected: build writes `dist/en/history.html` and `dist/es/historia.html`; full suite green. (If a pre-existing concurrency flake appears in build.test.js/business-page.test.js, re-run with `node --test --test-concurrency=1 'tests/**/*.test.js'` to confirm green.)

- [ ] **Step 6: Commit**

```bash
git add templates/pages/history.html tests/history-page.test.js
git commit -m "feat: long-form history template + print-to-PDF + byline/watermark"
```

---

## Self-Review

**Spec coverage:**
- Long-form bilingual page + print-to-PDF (approach A): Task 3 (template + `@media print` + `window.print()`). ✓
- 12-section structure: hero (1) + 9 narrative sections (2–10: place/origins/administrative/faith/cristero/economy/people/culture/book1897) + sources/method (11) + footer byline (12). ✓
- Brand "Compilado por Jaime Murillo": `byline` token on screen + print watermark/footer. ✓
- Accuracy fixes: Task 1 (base.html schema) + Task 2 (history.json no "1793"/"1,980", uses "1,907/1,900"). ✓ Supersedes the spawned chip.
- Honest gaps (Cristero/migration/parish dates): written into the content as caveats. ✓
- Public/indexable: `meta.robots` untouched (defaults to index,follow); no sitemap/slug change. ✓
- Text-only 1897 book, existing images only: no new image assets referenced. ✓
- Tests per repo convention: `tests/history-page.test.js`. ✓

**Placeholder scan:** The only intentional marker is the `rental` copy-verbatim instruction in Task 2 Step 3 (with an explicit implementer note) — a deliberate "copy existing" directive, not an unfilled blank. All prose content is final. No TBD/TODO.

**Type/token consistency:** Section keys `place/origins/administrative/faith/cristero/economy/people/culture/book1897` match between `history.json` (Task 2), the content test (Task 2), and the template ids `sec-<key>` + tokens (Task 3). `byline`, `pdf.label`, `sources.h2/note/body`, `hero.kicker/h1/intro` are defined in Task 2 and consumed in Task 3. `nav_urls.things-to-do` uses the hyphenated key the render supports.

## Out of scope (future)
Scanned 1897-book page figures; headless-Chromium PDF; locality-specific Cristero/migration research; the private family tree (separate branch — only a footer link here).
